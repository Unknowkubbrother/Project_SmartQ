import { useEffect, useState } from 'react';

export const useSpeechSynthesis = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = (text: string) => {
    if (speaking) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find Thai voice, fallback to default
    const thaiVoice = voices.find(voice => 
      voice.lang === 'th-TH' || voice.lang.startsWith('th')
    );
    
    if (thaiVoice) {
      utterance.voice = thaiVoice;
    }
    
    utterance.lang = 'th-TH';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const cancel = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return { speak, cancel, speaking, voices };
};
