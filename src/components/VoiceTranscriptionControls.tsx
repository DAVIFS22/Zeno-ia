import React, { useState, useRef } from 'react';
import { Mic, MessageSquare, StopCircle } from 'lucide-react';

export const VoiceTranscriptionControls = () => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  const startTranscription = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    
    mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', blob);
      
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const { text } = await res.json();
      alert(`Transcription: ${text}`); // Simple UI for now
    };
    
    mediaRecorder.current.start();
    setIsRecording(true);
  };

  const stopTranscription = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  const startLiveConversation = () => {
    const ws = new WebSocket(`ws://${location.host}/api/live`);
    ws.onopen = () => alert("Live conversation started!");
    ws.onmessage = (event) => console.log("Received:", event.data);
  };

  return (
    <div className="flex gap-2">
      <button 
        onClick={isRecording ? stopTranscription : startTranscription}
        className={`p-2 rounded-full ${isRecording ? 'bg-red-500' : 'bg-zeno'} text-white`}
      >
        {isRecording ? <StopCircle /> : <Mic />}
      </button>
      <button 
        onClick={startLiveConversation}
        className="p-2 rounded-full bg-zeno text-white"
      >
        <MessageSquare />
      </button>
    </div>
  );
};
