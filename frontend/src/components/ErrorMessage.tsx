import { X } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onClose: () => void;
}

export default function ErrorMessage({ message, onClose }: ErrorMessageProps) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
      <span>{message}</span>
      <button
        onClick={onClose}
        className="text-red-400 hover:text-red-600 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
