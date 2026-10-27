import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook untuk Voice-to-Text menggunakan Web Speech API Bahasa Indonesia (id-ID)
 * Memudahkan guru PAUD mendiktekan jurnal dan refleksi kegiatan langsung dari smartphone.
 */
export const useSpeechToText = (options = {}) => {
  const [isListening, setIsListening] = useState(false);
  // `transcript` hanya berisi potongan kalimat FINAL terbaru (bukan akumulasi), sehingga
  // komponen cukup menambahkannya ke field lalu memanggil resetTranscript().
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  // Periksa ketersediaan Web Speech API pada browser
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) {
      setError('Browser ini tidak mendukung fitur Voice-to-Text (Web Speech API).');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = options.continuous !== undefined ? options.continuous : true;
    recognition.interimResults = options.interimResults !== undefined ? options.interimResults : true;
    recognition.lang = options.lang || 'id-ID'; // Bahasa Indonesia

    recognition.onresult = (event) => {
      let finalChunk = '';
      let interimChunk = '';
      // Mulai dari resultIndex: hasil sebelumnya sudah pernah dikirim ke komponen
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += text;
        else interimChunk += text;
      }
      setInterimTranscript(interimChunk);
      if (finalChunk.trim()) {
        setTranscript((prev) => (prev ? `${prev} ${finalChunk.trim()}` : finalChunk.trim()));
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Izin akses mikrofon ditolak. Izinkan mikrofon di pengaturan browser Anda.');
      } else if (event.error === 'no-speech') {
        // Abaikan jika hanya hening sebentar
      } else {
        setError(`Gangguan pengenalan suara: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSupported, options.continuous, options.interimResults, options.lang]);

  const startListening = useCallback(() => {
    setError(null);
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (err) {
        console.error('Failed to stop speech recognition:', err);
      }
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  };
};

export default useSpeechToText;

