import { readDb, writeDb, addSystemLog } from './limits';
import { QueuedTask } from './databaseAdapter';

// Keep reference to core image generator function so we can trigger it
let imageGeneratorCallback: ((options: any) => Promise<any>) | null = null;
let isProcessingLocalQueue = false;

/**
 * Register the core image generator callback
 */
export function registerImageGenerator(callback: (options: any) => Promise<any>) {
  imageGeneratorCallback = callback;
}

/**
 * Calculates the dynamic average wait time of completed tasks in seconds.
 * Defaults to 10 seconds if no history exists.
 */
export async function getAverageWaitTimeSeconds(): Promise<number> {
  try {
    const db = await readDb();
    const tasks = Object.values(db.tasks || {});
    
    // Filter last 10 completed tasks
    const completedTasks = tasks
      .filter(t => t.status === 'completed' && t.finishedAt && t.createdAt)
      .sort((a, b) => b.finishedAt! - a.finishedAt!)
      .slice(0, 10);

    if (completedTasks.length === 0) {
      return 10; // Default estimate
    }

    const totalDurationMs = completedTasks.reduce((acc, t) => {
      return acc + (t.finishedAt! - t.createdAt);
    }, 0);

    const averageMs = totalDurationMs / completedTasks.length;
    return Math.max(2, Math.round(averageMs / 1000));
  } catch (err) {
    console.error('[TASK MANAGER] Erro ao calcular tempo médio:', err);
    return 10;
  }
}

/**
 * Creates and queues a new image generation task
 */
export async function createQueuedTask(options: {
  userId: string;
  userEmail: string;
  plan: 'ZENO Free' | 'ZENO Pro' | 'ADMIN';
  payload: {
    prompt: string;
    style: string;
    aspectRatio: string;
    enhance: boolean;
    engine: string;
    negativePrompt: string;
    seed?: number;
    guidanceScale?: number;
  };
  req?: any;
}): Promise<QueuedTask> {
  const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  
  const task: QueuedTask = {
    id: taskId,
    userId: options.userId,
    userEmail: options.userEmail,
    plan: options.plan,
    status: 'queued',
    payload: options.payload,
    createdAt: Date.now(),
    retryCount: 0
  };

  // Save to persistent db.json
  const db = await readDb();
  if (!db.tasks) db.tasks = {};
  db.tasks[taskId] = task;
  await writeDb(db);

  console.log(`[TASK MANAGER] Tarefa persistida no banco: ${taskId} (${options.plan})`);
  await addSystemLog('ia', options.userEmail, 'Enfileiramento de Tarefa', `Tarefa ${taskId} adicionada com plano ${options.plan}`, options.req);

  return task;
}

/**
 * Retrieves the status of a specific task and computes queue metrics
 */
export async function getTaskStatusDetails(taskId: string): Promise<{
  task: QueuedTask | null;
  position: number | null;
  estimatedTimeSeconds: number | null;
  averageWaitTimeSeconds: number;
}> {
  const db = await readDb();
  const task = db.tasks?.[taskId] || null;
  const avgWait = await getAverageWaitTimeSeconds();

  if (!task) {
    return { task: null, position: null, estimatedTimeSeconds: null, averageWaitTimeSeconds: avgWait };
  }

  // Users with plans other than ZENO Free (ZENO Pro, ADMIN) never see queue wait info
  if (task.plan !== 'ZENO Free') {
    return { task, position: null, estimatedTimeSeconds: null, averageWaitTimeSeconds: avgWait };
  }

  // If the task is no longer in the queue, position and wait estimates are null
  if (task.status !== 'queued') {
    return { task, position: null, estimatedTimeSeconds: null, averageWaitTimeSeconds: avgWait };
  }

  // Calculate position in queue for ZENO Free tasks
  try {
    const allQueuedFreeTasks = Object.values(db.tasks || {})
      .filter(t => t.status === 'queued' && t.plan === 'ZENO Free')
      .sort((a, b) => a.createdAt - b.createdAt);

    const index = allQueuedFreeTasks.findIndex(t => t.id === taskId);
    const position = index >= 0 ? index + 1 : 1;
    const estimatedTimeSeconds = position * avgWait;

    return {
      task,
      position,
      estimatedTimeSeconds,
      averageWaitTimeSeconds: avgWait
    };
  } catch (err) {
    console.error('[TASK MANAGER] Erro ao computar métricas da fila:', err);
    return { task, position: 1, estimatedTimeSeconds: avgWait, averageWaitTimeSeconds: avgWait };
  }
}

/**
 * Cancels a queued or processing task
 */
export async function cancelQueuedTask(taskId: string, userEmail: string, req?: any): Promise<boolean> {
  const db = await readDb();
  const task = db.tasks?.[taskId];

  if (!task) {
    console.warn(`[TASK MANAGER] Tentativa de cancelar tarefa inexistente: ${taskId}`);
    return false;
  }

  if (task.status === 'completed' || task.status === 'failed') {
    console.warn(`[TASK MANAGER] Tentativa de cancelar tarefa já encerrada: ${taskId} (${task.status})`);
    return false;
  }

  const oldStatus = task.status;
  task.status = 'cancelled';
  task.finishedAt = Date.now();
  db.tasks[taskId] = task;
  await writeDb(db);

  console.log(`[TASK MANAGER] Tarefa ${taskId} cancelada pelo usuário de ${oldStatus}.`);
  await addSystemLog('info', userEmail, 'Cancelamento de Tarefa', `Tarefa ${taskId} cancelada de status: ${oldStatus}`, req);
  return true;
}

/**
 * Processes a task securely, invoking the image generator and updating states
 */
export async function executeAndProcessTask(taskId: string, req?: any): Promise<any> {
  const db = await readDb();
  const task = db.tasks?.[taskId];

  if (!task) {
    console.error(`[TASK MANAGER] Execução abortada: tarefa não encontrada: ${taskId}`);
    throw new Error('Tarefa não encontrada.');
  }

  if (task.status === 'cancelled') {
    console.log(`[TASK MANAGER] Tarefa ${taskId} foi cancelada previamente pelo usuário. Abortando execução.`);
    return task;
  }

  if (task.status === 'completed') {
    console.log(`[TASK MANAGER] Tarefa ${taskId} já foi concluída. Ignorando.`);
    return task;
  }

  // Update status to processing
  task.status = 'processing';
  task.startedAt = Date.now();
  db.tasks[taskId] = task;
  await writeDb(db);

  console.log(`[TASK MANAGER] Iniciando processamento da tarefa ${taskId}...`);

  try {
    if (!imageGeneratorCallback) {
      throw new Error('Gerador de imagens do ZENO não registrado.');
    }

    // Call core image generator callback
    const result = await imageGeneratorCallback({
      prompt: task.payload.prompt,
      style: task.payload.style,
      aspectRatio: task.payload.aspectRatio,
      enhance: task.payload.enhance,
      engine: task.payload.engine,
      negativePrompt: task.payload.negativePrompt,
      seed: task.payload.seed,
      guidanceScale: task.payload.guidanceScale,
      userEmail: task.userEmail,
      req
    });

    // Mark completed
    const reloadDb = await readDb();
    const currentTask = reloadDb.tasks?.[taskId] || task;
    
    if (currentTask.status === 'cancelled') {
      console.log(`[TASK MANAGER] Tarefa ${taskId} foi cancelada durante a geração. Descartando resultado.`);
      return currentTask;
    }

    currentTask.status = 'completed';
    currentTask.finishedAt = Date.now();
    currentTask.result = result;
    reloadDb.tasks[taskId] = currentTask;
    await writeDb(reloadDb);

    console.log(`[TASK MANAGER] Tarefa ${taskId} concluída com sucesso.`);
    await addSystemLog('ia', task.userEmail, 'Tarefa Concluída', `Imagem gerada com sucesso para a tarefa ${taskId}`, req);
    return currentTask;
  } catch (err: any) {
    console.error(`[TASK MANAGER] Erro ao processar tarefa ${taskId}:`, err?.message || err);
    
    const reloadDb = await readDb();
    const currentTask = reloadDb.tasks?.[taskId] || task;

    if (currentTask.status === 'cancelled') {
      return currentTask;
    }

    // Automatic retries limit
    if (currentTask.retryCount < 2) {
      currentTask.retryCount += 1;
      currentTask.status = 'queued'; // Keep as queued so it can be re-run
      reloadDb.tasks[taskId] = currentTask;
      await writeDb(reloadDb);
      
      console.log(`[TASK MANAGER] Agendando reprocessamento automático para a tarefa ${taskId}. Tentativa: ${currentTask.retryCount}/3`);
      await addSystemLog('error', task.userEmail, 'Erro de Processamento', `Erro na tarefa ${taskId}, reagendando tentativa ${currentTask.retryCount}: ${err?.message || err}`, req);
      
      // Propagate error to let the scheduler or caller handle retry state
      throw err;
    } else {
      currentTask.status = 'failed';
      currentTask.finishedAt = Date.now();
      currentTask.error = err?.message || 'Erro desconhecido durante o processamento';
      reloadDb.tasks[taskId] = currentTask;
      await writeDb(reloadDb);

      console.error(`[TASK MANAGER] Tarefa ${taskId} falhou definitivamente após reprocessamento.`);
      await addSystemLog('error', task.userEmail, 'Falha de Tarefa', `Tarefa ${taskId} falhou após limite de tentativas: ${err?.message || err}`, req);
      return currentTask;
    }
  }
}

/**
 * Fallback Local Scheduler queue loop
 */
export function initFallbackQueueRunner() {
  setInterval(async () => {
    if (isProcessingLocalQueue) return;
    isProcessingLocalQueue = true;

    try {
      const db = await readDb();
      const allTasks = Object.values(db.tasks || {});
      
      // Find all queued tasks
      const queuedTasks = allTasks.filter(t => t.status === 'queued');
      if (queuedTasks.length === 0) {
        isProcessingLocalQueue = false;
        return;
      }

      // Prioritization logic: ADMIN first, then ZENO Pro, then ZENO Free
      queuedTasks.sort((a, b) => {
        const priorityScore = { ADMIN: 3, 'ZENO Pro': 2, 'ZENO Free': 1 };
        const scoreA = priorityScore[a.plan] || 1;
        const scoreB = priorityScore[b.plan] || 1;
        
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // Descending priority
        }
        return a.createdAt - b.createdAt; // FIFO within priority
      });

      const nextTask = queuedTasks[0];
      console.log(`[LOCAL RUNNER] Selecionado tarefa na fila local: ${nextTask.id} (${nextTask.plan})...`);
      
      try {
        await executeAndProcessTask(nextTask.id);
      } catch (err) {
        // executeAndProcessTask updates the task states, we just suppress top-level loop crashes
        console.warn(`[LOCAL RUNNER] Execução da tarefa falhou: ${nextTask.id}`);
      }
    } catch (err) {
      console.error('[LOCAL RUNNER] Erro na thread de agendamento de tarefas:', err);
    } finally {
      isProcessingLocalQueue = false;
    }
  }, 1500);

  console.log('[TASK MANAGER] Fallback Local Scheduler inicializado e rodando a cada 1.5s.');
}

/**
 * Returns comprehensive system stats for task queues
 */
export async function getQueueDiagnosticStats(): Promise<{
  totalQueued: number;
  adminQueued: number;
  proQueued: number;
  freeQueued: number;
  totalCompleted: number;
  totalFailed: number;
  totalCancelled: number;
  averageWaitTimeSeconds: number;
}> {
  const db = await readDb();
  const tasks = Object.values(db.tasks || {});

  const adminQueued = tasks.filter(t => t.status === 'queued' && t.plan === 'ADMIN').length;
  const proQueued = tasks.filter(t => t.status === 'queued' && t.plan === 'ZENO Pro').length;
  const freeQueued = tasks.filter(t => t.status === 'queued' && t.plan === 'ZENO Free').length;
  
  return {
    totalQueued: adminQueued + proQueued + freeQueued,
    adminQueued,
    proQueued,
    freeQueued,
    totalCompleted: tasks.filter(t => t.status === 'completed').length,
    totalFailed: tasks.filter(t => t.status === 'failed').length,
    totalCancelled: tasks.filter(t => t.status === 'cancelled').length,
    averageWaitTimeSeconds: await getAverageWaitTimeSeconds()
  };
}
