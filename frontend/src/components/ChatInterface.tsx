'use client';

import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTranslation } from '@/hooks/useTranslation';
import { chatAPI } from '@/lib/api';
import { Send, Mic, MicOff, Bot, User, Play, Square, ImagePlus, X } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatInterface() {
  const { state, addChatMessage } = useApp();
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.chatMessages]);

  // Cleanup speech synthesis on component unmount
  useEffect(() => {
    return () => {
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      recognitionRef.current = new (window as any).webkitSpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = state.selectedLanguage === 'hindi' ? 'hi-IN' : 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setMessage(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [state.selectedLanguage]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSendMessage = async () => {
    const hasImage = !!imageFile;
    const hasText = message.trim().length > 0;
    if ((!hasText && !hasImage) || isLoading) return;

    const textToSend = message.trim();
    const userDisplayText = hasText ? message : 'Uploaded plant image for disease check';
    const userMessage = {
      id: Date.now().toString(),
      message: userDisplayText,
      response: '',
      classification: '',
      language: state.selectedLanguage,
      timestamp: new Date().toISOString(),
      isUser: true,
    };

    addChatMessage(userMessage);
    setMessage('');
    setImagePreview(null);
    const fileToSend = imageFile;
    setImageFile(null);
    setIsLoading(true);

    try {
      let response: { response: { message?: string }; classification?: string };

      if (hasImage && fileToSend) {
        const base64 = await fileToBase64(fileToSend);
        response = await chatAPI.sendDiseaseImage(base64, textToSend || undefined, state.selectedLanguage);
      } else {
        response = await chatAPI.sendMessage(textToSend, state.selectedLanguage);
      }

      const botMessage = {
        id: (Date.now() + 1).toString(),
        message: '',
        response: response.response?.message || (typeof response.response === 'string' ? response.response : ''),
        classification: response.classification || '',
        language: state.selectedLanguage,
        timestamp: new Date().toISOString(),
        isUser: false,
        model: (response as { model?: string }).model,
      };

      addChatMessage(botMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        message: '',
        response: 'Sorry, I encountered an error. Please try again.',
        classification: 'error',
        language: state.selectedLanguage,
        timestamp: new Date().toISOString(),
        isUser: false,
      };
      addChatMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageFile(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = (text: string, messageId: string) => {
    // Stop any current speech
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
    }

    // Clean text for speech (remove markdown formatting)
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/`(.*?)`/g, '$1') // Remove code
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Set language based on selected language
    const languageMap: { [key: string]: string } = {
      'english': 'en-US',
      'hindi': 'hi-IN',
      'telugu': 'te-IN',
      'kannada': 'kn-IN',
      'tamil': 'ta-IN',
      'malayalam': 'ml-IN'
    };
    
    utterance.lang = languageMap[state.selectedLanguage] || 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingMessageId(messageId);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      speechSynthesisRef.current = null;
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      speechSynthesisRef.current = null;
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      speechSynthesisRef.current = null;
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'crop_recommendation':
        return 'bg-green-100 text-green-800';
      case 'harvesting_guidance':
        return 'bg-yellow-100 text-yellow-800';
      case 'pest_control':
        return 'bg-red-100 text-red-800';
      case 'irrigation':
        return 'bg-blue-100 text-blue-800';
      case 'fertilization':
        return 'bg-purple-100 text-purple-800';
      case 'market_price':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{t('aiAssistant')}</h2>
            <p className="text-gray-500 text-sm">
              {t('chatDescription')} {state.selectedLanguage}
            </p>
          </div>
        </div>
        {/* Global TTS Controls */}
        {isSpeaking && (
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>{t('readingAloud')}</span>
            </div>
            <button
              onClick={stopSpeaking}
              className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
              title={t('stopAudio')}
            >
              <Square className="w-4 h-4" />
              <span>{t('stopAudio')}</span>
            </button>
          </div>
        )}
      </div>

      <div className="h-96 overflow-y-auto mb-6 space-y-4 pr-1">
        {state.chatMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-10">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Bot className="w-7 h-7 text-gray-400" />
            </div>
            <p className="font-medium text-gray-600">{t('startConversation')}</p>
            <div className="mt-4 text-sm text-gray-400 max-w-sm mx-auto">
              <p>{t('tryAsking')}</p>
              <ul className="mt-3 space-y-2 text-left">
                {t('exampleQuestions').map((question, index) => (
                  <li key={index} className="flex items-start gap-2"><span className="text-green-500">•</span> "{question}"</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          state.chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start space-x-3 max-w-xs lg:max-w-md ${
                  msg.isUser ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    msg.isUser
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {msg.isUser ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className={`p-3 ${
                      msg.isUser
                        ? 'bg-green-600 text-white rounded-2xl rounded-br-none'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-none'
                    }`}
                  >
                    {msg.isUser ? (
                      <p className="text-sm">{msg.message}</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ node, ...props }: any) => (
                                <a
                                  {...props}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${(props as any).className ?? ''} underline`}
                                />
                              ),
                            }}
                          >
                            {msg.response}
                          </ReactMarkdown>
                        </div>
                        {/* TTS Controls for bot messages */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                if (speakingMessageId === msg.id) {
                                  stopSpeaking();
                                } else {
                                  speakText(msg.response, msg.id);
                                }
                              }}
                              className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                                speakingMessageId === msg.id
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                              title={speakingMessageId === msg.id ? t('stopAudio') : 'Read aloud'}
                            >
                              {speakingMessageId === msg.id ? (
                                <>
                                  <Square className="w-3 h-3" />
                                  <span>{t('stopAudio')}</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3" />
                                  <span>{t('playAudio')}</span>
                                </>
                              )}
                            </button>
                            {speakingMessageId === msg.id && (
                              <div className="flex items-center space-x-1 text-xs text-gray-500">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                <span>{t('readingAloud')}...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {!msg.isUser && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] opacity-60 text-gray-500">{msg.model === 'local' ? 'Local AI' : 'CLOUD AI'}</span>
                      {msg.classification && (
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded-full ${getClassificationColor(
                            msg.classification
                          )}`}
                        >
                          {msg.classification.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none">
                <span className="text-sm text-gray-500">Thinking</span>
                <span className="inline-flex gap-1 ml-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
        aria-label="Upload plant image"
      />
      {imagePreview && (
        <div className="mb-3 flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
          <img src={imagePreview} alt="Plant" className="h-16 w-16 object-cover rounded-xl" />
          <span className="text-sm text-gray-600 flex-1">Plant image – will recommend pesticide after send</span>
          <button type="button" onClick={clearImage} className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="flex space-x-3">
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={imagePreview ? 'Add a note (optional)...' : `${t('askPlaceholder')} ${state.selectedLanguage}...`}
            className="input-field pr-24 resize-none"
            rows={2}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="absolute right-14 top-3 p-2 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-green-600 hover:bg-green-50"
            title="Upload plant photo for disease / pesticide recommendation"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <button
            onClick={toggleListening}
            disabled={!recognitionRef.current || isLoading}
            className={`absolute right-3 top-3 p-2 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isListening ? 'text-red-500 bg-red-50' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>
        <button
          onClick={handleSendMessage}
          disabled={(!message.trim() && !imagePreview) || isLoading}
          className="btn-primary flex items-center justify-center rounded-2xl px-5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Tip: Upload a photo of a diseased plant to get pesticide and treatment recommendations.
      </p>
    </div>
  );
}
