import React, { useState } from 'react';
import { X, Folder, Plus, Trash2, FolderPlus, FileText, ArrowRight, Check } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  updatedAt: string;
}

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject?: (project: Project) => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  onSelectProject
}) => {
  const [projects, setProjects] = useState<Project[]>([
    { id: '1', name: 'Desenvolvimento Web', description: 'Componentes React, APIs Node e scripts TypeScript', itemCount: 8, updatedAt: 'Hoje' },
    { id: '2', name: 'Análise de Dados & IA', description: 'Prompts avançados, resumos e tratamento de dados', itemCount: 4, updatedAt: 'Ontem' },
    { id: '3', name: 'Marketing & Conteúdo', description: 'Redação estratégica e criação de artigos', itemCount: 2, updatedAt: 'Esta semana' }
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string>('1');

  if (!isOpen) return null;

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newProj: Project = {
      id: Date.now().toString(),
      name: newName.trim(),
      description: newDesc.trim() || 'Projeto personalizado no ZENO AI',
      itemCount: 0,
      updatedAt: 'Hoje'
    };

    setProjects(prev => [newProj, ...prev]);
    setNewName('');
    setNewDesc('');
    setIsCreating(false);
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Deseja excluir este projeto?')) {
      setProjects(prev => prev.filter(p => p.id !== id));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#171717] border border-[#303030] text-white overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#303030] flex items-center justify-between bg-[#171717]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#242424] text-white">
              <Folder className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Projetos</h2>
              <p className="text-xs text-[#A8A8A8]">Organize suas conversas e arquivos por contexto</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#242424] text-[#A8A8A8] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 bg-[#0D0D0D] flex-1 scrollbar-custom">
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#A8A8A8]">Seus Projetos Ativos</span>
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="px-3 py-1.5 rounded-xl bg-[#242424] hover:bg-[#2F2F2F] text-white text-xs font-medium border border-[#303030] flex items-center gap-1.5 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Novo Projeto</span>
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreateProject} className="p-4 rounded-xl bg-[#171717] border border-[#303030] space-y-3 animate-fadeIn">
              <h3 className="text-xs font-semibold text-white">Criar Novo Projeto</h3>
              <div>
                <label className="text-[11px] text-[#A8A8A8] block mb-1">Nome do Projeto</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Projeto E-commerce React"
                  className="w-full bg-[#242424] border border-[#303030] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-[#A8A8A8] block mb-1">Descrição</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Instruções ou contexto do projeto..."
                  className="w-full bg-[#242424] border border-[#303030] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs bg-[#2F2F2F] hover:bg-[#303030] text-white font-medium rounded-lg border border-[#303030]"
                >
                  Salvar Projeto
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {projects.map(proj => {
              const isSelected = activeProjectId === proj.id;

              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    setActiveProjectId(proj.id);
                    if (onSelectProject) onSelectProject(proj);
                  }}
                  className={`p-3.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#2F2F2F] border-[#505050] text-white'
                      : 'bg-[#171717] border-[#303030] text-[#A8A8A8] hover:text-white hover:bg-[#242424]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Folder className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-[#A8A8A8]'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{proj.name}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#242424] border border-[#303030] text-white font-medium">
                            Ativo
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#A8A8A8] mt-0.5">{proj.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-[#A8A8A8]">
                        <span>{proj.itemCount} itens</span>
                        <span>•</span>
                        <span>Atualizado {proj.updatedAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDeleteProject(proj.id, e)}
                      className="p-1.5 rounded-lg hover:bg-[#242424] text-[#A8A8A8] hover:text-white transition-colors"
                      title="Excluir Projeto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#303030] bg-[#171717] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#242424] hover:bg-[#2F2F2F] text-white text-xs font-medium border border-[#303030] transition-colors"
          >
            Concluído
          </button>
        </div>

      </div>
    </div>
  );
};
