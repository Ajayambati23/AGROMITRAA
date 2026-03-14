# AgroMitra Frontend

A modern, responsive Next.js frontend for the AgroMitra AI agricultural chatbot.

## 🚀 Features

- **Modern UI/UX**: Built with Next.js 15, TypeScript, and Tailwind CSS
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Multilingual Support**: 6 languages (English, Hindi, Telugu, Kannada, Tamil, Malayalam)
- **Real-time Chat**: AI-powered agricultural assistance with voice input
- **Crop Recommendations**: Personalized crop suggestions based on location and soil
- **Market Prices**: Real-time agricultural commodity pricing
- **Farming Calendar**: Activity tracking and scheduling
- **Authentication**: Secure user registration and login
- **Voice Integration**: Speech-to-text and text-to-speech support

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Forms**: React Hook Form with Zod validation
- **Animations**: Framer Motion

## 📦 Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your backend API URL:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001/api
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page
│   ├── components/            # React components
│   │   ├── Header.tsx         # Navigation header
│   │   ├── ChatInterface.tsx  # AI chat component
│   │   ├── CropRecommendations.tsx
│   │   ├── MarketPrices.tsx
│   │   ├── Calendar.tsx
│   │   ├── LoginModal.tsx
│   │   ├── RegisterModal.tsx
│   │   └── ...
│   ├── contexts/              # React contexts
│   │   └── AppContext.tsx     # Global state management
│   └── lib/                   # Utilities
│       └── api.ts            # API client
├── public/                    # Static assets
├── .env.local                # Environment variables
└── package.json
```

## 🎯 Key Components

### ChatInterface
- Real-time AI chat with agricultural expertise
- Voice input/output support
- Multilingual responses
- Message history and context

### CropRecommendations
- Personalized crop suggestions
- Filter by season, soil type, location
- Detailed crop information
- Suitability scoring

### MarketPrices
- Real-time commodity pricing
- Multiple currency support
- Price trends and updates
- Market information

### Calendar
- Farming activity scheduling
- Crop lifecycle tracking
- Upcoming activity reminders
- Progress monitoring

## 🌐 API Integration

The frontend communicates with the backend API through:

- **Authentication**: User registration, login, profile management
- **Crops**: Crop data, recommendations, detailed information
- **Chat**: AI conversation handling
- **Calendar**: Activity scheduling and tracking
- **Voice**: Language and format support
- **Training**: AI model management

## 🎨 Styling

- **Tailwind CSS**: Utility-first CSS framework
- **Custom Components**: Reusable styled components
- **Responsive Design**: Mobile-first approach
- **Dark/Light Mode**: Theme support (planned)
- **Animations**: Smooth transitions and interactions

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Quality

- **TypeScript**: Type safety and better development experience
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting (recommended)
- **Husky**: Git hooks for quality checks (optional)

## 🚀 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables
4. Deploy automatically

### Other Platforms

- **Netlify**: Static site hosting
- **AWS Amplify**: Full-stack deployment
- **Docker**: Containerized deployment

## 🔐 Environment Variables

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Optional: Analytics, monitoring, etc.
NEXT_PUBLIC_GA_ID=your_google_analytics_id
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

## 📱 Mobile Support

- **Responsive Design**: Works on all screen sizes
- **Touch Gestures**: Optimized for mobile interaction
- **Voice Input**: Mobile-friendly speech recognition
- **Offline Support**: Basic offline functionality (planned)

## 🌍 Internationalization

- **6 Languages**: Full multilingual support
- **RTL Support**: Right-to-left language support (planned)
- **Cultural Adaptation**: Region-specific content
- **Dynamic Language Switching**: Real-time language changes

## 🧪 Testing

```bash
# Run tests (when implemented)
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📈 Performance

- **Next.js Optimization**: Automatic code splitting, image optimization
- **Lazy Loading**: Components loaded on demand
- **Caching**: API response caching
- **Bundle Analysis**: Built-in bundle analyzer

## 🐛 Troubleshooting

### Common Issues

1. **API Connection Failed**:
   - Check if backend server is running
   - Verify `NEXT_PUBLIC_API_URL` in `.env.local`

2. **Build Errors**:
   - Clear `.next` folder: `rm -rf .next`
   - Reinstall dependencies: `rm -rf node_modules && npm install`

3. **TypeScript Errors**:
   - Run `npm run type-check`
   - Check type definitions in `lib/api.ts`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is part of the AgroMitra agricultural AI chatbot system.

## 🆘 Support

For support and questions:
- Check the main project README
- Review API documentation
- Open an issue on GitHub

---

**AgroMitra Frontend** - Modern, responsive, and feature-rich agricultural AI interface.