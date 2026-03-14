const natural = require('natural');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { getTranslation, detectLanguage } = require('../utils/translations');
const Crop = require('../models/Crop');
const Calendar = require('../models/Calendar');

const stripBom = (text) => {
  if (typeof text !== 'string') return text;
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
};

class AIService {
  constructor() {
    this.classifier = new natural.BayesClassifier();
    this.trained = false;
    this.openai = null;
    this.trainingData = [];
    this.modelPath = path.join(__dirname, '../models/trained-model.json');
    this.datasetsPath = path.join(__dirname, '../datasets');
    this.initializeServices();
  }

  async initializeServices() {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      console.log('OpenAI initialized successfully');
    } else {
      console.log('OpenAI API key not found, using local models only');
    }

    // Load training data first, then train classifier (order matters for offline AI)
    await this.loadTrainingData();
    await this.initializeClassifier();
  }

  /**
   * Load and merge training data from datasets folder (e.g. datasets/*.json).
   * Each item must have at least { text, category }; language and extra fields are optional.
   */
  loadFromDatasetsFolder() {
    const merged = [];
    const seen = new Set();
    const key = (item) => `${(item.text || '').trim()}\n${item.category || ''}`;

    if (!fs.existsSync(this.datasetsPath)) {
      return merged;
    }

    const files = fs.readdirSync(this.datasetsPath);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(this.datasetsPath, file);
      try {
        const data = stripBom(fs.readFileSync(filePath, 'utf8'));
        const parsed = JSON.parse(data);
        const items = Array.isArray(parsed) ? parsed : (parsed.data || []);
        for (const item of items) {
          if (!item || typeof item.text !== 'string' || typeof item.category !== 'string') continue;
          const k = key(item);
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push({
            text: item.text.trim(),
            category: item.category,
            language: item.language || 'english'
          });
        }
      } catch (err) {
        console.warn('Could not load dataset file:', file, err.message);
      }
    }
    return merged;
  }

  async loadTrainingData() {
    try {
      // 1) Load from trained-model.json if it exists
      if (fs.existsSync(this.modelPath)) {
        const data = stripBom(fs.readFileSync(this.modelPath, 'utf8'));
        const parsed = JSON.parse(data);
        this.trainingData = Array.isArray(parsed) ? parsed : (parsed.data || []);
        this.trainingData = this.trainingData.filter(
          (item) => item && typeof item.text === 'string' && typeof item.category === 'string'
        );
        console.log('Training data loaded from file:', this.trainingData.length, 'samples');
      } else {
        this.trainingData = [];
      }

      // 2) Merge in data from datasets folder (dedupe by text+category)
      const fromDatasets = this.loadFromDatasetsFolder();
      if (fromDatasets.length > 0) {
        const seen = new Set(this.trainingData.map((item) => `${(item.text || '').trim()}\n${item.category || ''}`));
        for (const item of fromDatasets) {
          const k = `${item.text}\n${item.category}`;
          if (!seen.has(k)) {
            seen.add(k);
            this.trainingData.push(item);
          }
        }
        console.log('Merged datasets folder:', fromDatasets.length, 'samples; total:', this.trainingData.length);
      }

      // 3) If still no valid samples, use defaults
      if (this.trainingData.length === 0) {
        console.warn('No valid training data; using default dataset');
        this.trainingData = this.getDefaultTrainingData();
        await this.saveTrainingData();
      }
    } catch (error) {
      console.error('Error loading training data:', error);
      this.trainingData = this.getDefaultTrainingData();
    }
  }

  getDefaultTrainingData() {
    return [
      // English training data
      { text: 'crop recommendation', category: 'crop_recommendation', language: 'english' },
      { text: 'what crop to plant', category: 'crop_recommendation', language: 'english' },
      { text: 'best crop for my soil', category: 'crop_recommendation', language: 'english' },
      { text: 'harvesting guide', category: 'harvesting_guidance', language: 'english' },
      { text: 'when to harvest', category: 'harvesting_guidance', language: 'english' },
      { text: 'harvesting steps', category: 'harvesting_guidance', language: 'english' },
      { text: 'pest control', category: 'pest_control', language: 'english' },
      { text: 'insect problem', category: 'pest_control', language: 'english' },
      { text: 'disease treatment', category: 'pest_control', language: 'english' },
      { text: 'irrigation schedule', category: 'irrigation', language: 'english' },
      { text: 'watering frequency', category: 'irrigation', language: 'english' },
      { text: 'water management', category: 'irrigation', language: 'english' },
      { text: 'fertilizer schedule', category: 'fertilization', language: 'english' },
      { text: 'when to fertilize', category: 'fertilization', language: 'english' },
      { text: 'nutrient management', category: 'fertilization', language: 'english' },
      { text: 'weather forecast', category: 'weather', language: 'english' },
      { text: 'rain prediction', category: 'weather', language: 'english' },
      { text: 'market price', category: 'market_price', language: 'english' },
      { text: 'crop price', category: 'market_price', language: 'english' },
      { text: 'selling price', category: 'market_price', language: 'english' },
      
      // Hindi training data
      { text: 'फसल सुझाव', category: 'crop_recommendation', language: 'hindi' },
      { text: 'कौन सी फसल लगाएं', category: 'crop_recommendation', language: 'hindi' },
      { text: 'मिट्टी के लिए सबसे अच्छी फसल', category: 'crop_recommendation', language: 'hindi' },
      { text: 'कटाई मार्गदर्शन', category: 'harvesting_guidance', language: 'hindi' },
      { text: 'कब काटें', category: 'harvesting_guidance', language: 'hindi' },
      { text: 'कटाई के चरण', category: 'harvesting_guidance', language: 'hindi' },
      { text: 'कीट नियंत्रण', category: 'pest_control', language: 'hindi' },
      { text: 'कीट की समस्या', category: 'pest_control', language: 'hindi' },
      { text: 'रोग का उपचार', category: 'pest_control', language: 'hindi' },
      { text: 'सिंचाई का समय', category: 'irrigation', language: 'hindi' },
      { text: 'पानी देने की आवृत्ति', category: 'irrigation', language: 'hindi' },
      { text: 'जल प्रबंधन', category: 'irrigation', language: 'hindi' },
      { text: 'खाद का समय', category: 'fertilization', language: 'hindi' },
      { text: 'कब खाद डालें', category: 'fertilization', language: 'hindi' },
      { text: 'पोषक तत्व प्रबंधन', category: 'fertilization', language: 'hindi' },
      { text: 'मौसम पूर्वानुमान', category: 'weather', language: 'hindi' },
      { text: 'बारिश की भविष्यवाणी', category: 'weather', language: 'hindi' },
      { text: 'बाजार मूल्य', category: 'market_price', language: 'hindi' },
      { text: 'फसल की कीमत', category: 'market_price', language: 'hindi' },
      { text: 'बिक्री मूल्य', category: 'market_price', language: 'hindi' },

      // Telugu training data
      { text: 'పంట సిఫార్సు', category: 'crop_recommendation', language: 'telugu' },
      { text: 'ఏ పంట నాటాలి', category: 'crop_recommendation', language: 'telugu' },
      { text: 'నేలకు ఉత్తమ పంట', category: 'crop_recommendation', language: 'telugu' },
      { text: 'పంట కోత మార్గదర్శకత్వం', category: 'harvesting_guidance', language: 'telugu' },
      { text: 'ఎప్పుడు కోయాలి', category: 'harvesting_guidance', language: 'telugu' },
      { text: 'కోత దశలు', category: 'harvesting_guidance', language: 'telugu' },
      { text: 'కీటక నియంత్రణ', category: 'pest_control', language: 'telugu' },
      { text: 'కీటక సమస్య', category: 'pest_control', language: 'telugu' },
      { text: 'వ్యాధి చికిత్స', category: 'pest_control', language: 'telugu' },
      { text: 'నీటిపారుదల షెడ్యూల్', category: 'irrigation', language: 'telugu' },
      { text: 'నీరు ఇవ్వడం', category: 'irrigation', language: 'telugu' },
      { text: 'నీటి నిర్వహణ', category: 'irrigation', language: 'telugu' },
      { text: 'ఎరువు షెడ్యూల్', category: 'fertilization', language: 'telugu' },
      { text: 'ఎప్పుడు ఎరువు', category: 'fertilization', language: 'telugu' },
      { text: 'పోషక నిర్వహణ', category: 'fertilization', language: 'telugu' },
      { text: 'వాతావరణ అంచనా', category: 'weather', language: 'telugu' },
      { text: 'వర్షం అంచనా', category: 'weather', language: 'telugu' },
      { text: 'మార్కెట్ ధర', category: 'market_price', language: 'telugu' },
      { text: 'పంట ధర', category: 'market_price', language: 'telugu' },
      { text: 'విక్రయ ధర', category: 'market_price', language: 'telugu' }
    ];
  }

  async saveTrainingData() {
    try {
      const dataDir = path.dirname(this.modelPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(this.modelPath, JSON.stringify(this.trainingData, null, 2));
      console.log('Training data saved to file');
    } catch (error) {
      console.error('Error saving training data:', error);
    }
  }

  async initializeClassifier() {
    try {
      // Train the classifier with loaded data
      this.trainingData.forEach(item => {
        this.classifier.addDocument(item.text, item.category);
      });

      this.classifier.train();
      this.trained = true;
      console.log('AI Classifier trained successfully with', this.trainingData.length, 'samples');
    } catch (error) {
      console.error('Error training classifier:', error);
    }
  }

  async processQuery(query, user, language = 'english') {
    try {
      if (!this.trained) {
        if (this.trainingData.length === 0) {
          await this.loadTrainingData();
        }
        await this.initializeClassifier();
      }

      // Detect language if not provided
      const detectedLanguage = detectLanguage(query);
      const queryLanguage = language || detectedLanguage;

      // Try OpenAI first if available
      if (this.openai) {
        try {
          const openaiResponse = await this.processWithOpenAI(query, user, queryLanguage);
          if (openaiResponse.success) {
            return openaiResponse;
          }
        } catch (error) {
          console.log('OpenAI processing failed, falling back to local model:', error.message);
        }
      }

      // Fallback to local classifier
      const classification = this.classifier.classify(query);
      const confidence = this.classifier.getClassifications(query);

      // Process based on classification
      let response = await this.generateResponse(classification, query, user, queryLanguage);

      return {
        success: true,
        classification,
        confidence: confidence[0]?.value || 0,
        response,
        language: queryLanguage,
        model: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        response: getTranslation('welcome', language)
      };
    }
  }

  async processWithOpenAI(query, user, language = 'english') {
    try {
      const systemPrompt = this.getSystemPrompt(language);
      const userContext = this.getUserContext(user, language);

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `${userContext}\n\nUser Query: ${query}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });

      const rawContent = completion.choices?.[0]?.message?.content;
      const response = (rawContent != null && typeof rawContent === 'string') ? rawContent : '';
      const classification = this.classifyOpenAIResponse(response);

      return {
        success: true,
        classification,
        confidence: 0.9, // High confidence for GPT responses
        response: {
          type: classification,
          message: response,
          source: 'openai'
        },
        language: language,
        model: 'openai'
      };
    } catch (error) {
      throw new Error(`OpenAI processing failed: ${error.message}`);
    }
  }

  getSystemPrompt(language) {
    const prompts = {
      english: `You are AgroMitra, an AI agricultural assistant for farmers and agricultural students. You provide expert advice on:
      - Crop recommendations based on season, soil type, and location
      - Harvesting guidance and best practices
      - Pest control and disease management
      - Irrigation and water management
      - Fertilization schedules and nutrient management
      - Weather-related agricultural advice
      - Market prices and agricultural economics
      
      Always respond in a helpful, professional manner. Provide specific, actionable advice based on Indian agricultural practices.`,
      
      hindi: `आप AgroMitra हैं, किसानों और कृषि छात्रों के लिए एक AI कृषि सहायक। आप निम्नलिखित पर विशेषज्ञ सलाह प्रदान करते हैं:
      - मौसम, मिट्टी के प्रकार और स्थान के आधार पर फसल सुझाव
      - कटाई मार्गदर्शन और सर्वोत्तम प्रथाएं
      - कीट नियंत्रण और रोग प्रबंधन
      - सिंचाई और जल प्रबंधन
      - खाद कार्यक्रम और पोषक तत्व प्रबंधन
      - मौसम संबंधी कृषि सलाह
      - बाजार मूल्य और कृषि अर्थशास्त्र
      
      हमेशा सहायक, पेशेवर तरीके से जवाब दें। भारतीय कृषि प्रथाओं के आधार पर विशिष्ट, क्रियाशील सलाह प्रदान करें।`,
      
      telugu: `మీరు AgroMitra, రైతులు మరియు వ్యవసాయ విద్యార్థుల కోసం AI వ్యవసాయ సహాయకుడు. మీరు ఈ క్రింది విషయాలపై నిపుణుల సలహాలను అందిస్తారు:
      - కాలం, నేల రకం మరియు స్థానం ఆధారంగా పంట సిఫార్సులు
      - పంట కోత మార్గదర్శకత్వం మరియు ఉత్తమ పద్ధతులు
      - కీటక నియంత్రణ మరియు వ్యాధి నిర్వహణ
      - నీటిపారుదల మరియు నీటి నిర్వహణ
      - ఎరువు కార్యక్రమాలు మరియు పోషక నిర్వహణ
      - వాతావరణ సంబంధిత వ్యవసాయ సలహాలు
      - మార్కెట్ ధరలు మరియు వ్యవసాయ ఆర్థిక శాస్త్రం
      
      ఎల్లప్పుడూ సహాయక, వృత్తిపరమైన పద్ధతిలో ప్రతిస్పందించండి. భారతీయ వ్యవసాయ పద్ధతుల ఆధారంగా నిర్దిష్టమైన, చర్యాత్మక సలహాలను అందించండి।`
    };

    return prompts[language] || prompts.english;
  }

  getUserContext(user, language) {
    const context = {
      user: {
        name: user.name || 'User',
        location: user.location?.state || 'Unknown',
        soilType: user.soilType || 'Unknown',
        experience: user.experience || 'beginner',
        preferredLanguage: user.preferredLanguage || 'english'
      }
    };

    return `User Context: ${JSON.stringify(context, null, 2)}`;
  }

  classifyOpenAIResponse(response) {
    const responseLower = response.toLowerCase();
    
    if (responseLower.includes('crop') || responseLower.includes('फसल') || responseLower.includes('పంట')) {
      return 'crop_recommendation';
    } else if (responseLower.includes('harvest') || responseLower.includes('कटाई') || responseLower.includes('కోత')) {
      return 'harvesting_guidance';
    } else if (responseLower.includes('pest') || responseLower.includes('कीट') || responseLower.includes('కీటక')) {
      return 'pest_control';
    } else if (responseLower.includes('water') || responseLower.includes('सिंचाई') || responseLower.includes('నీటిపారుదల')) {
      return 'irrigation';
    } else if (responseLower.includes('fertilizer') || responseLower.includes('खाद') || responseLower.includes('ఎరువు')) {
      return 'fertilization';
    } else if (responseLower.includes('weather') || responseLower.includes('मौसम') || responseLower.includes('వాతావరణ')) {
      return 'weather';
    } else if (responseLower.includes('price') || responseLower.includes('मूल्य') || responseLower.includes('ధర')) {
      return 'market_price';
    } else {
      return 'general';
    }
  }

  async generateResponse(classification, query, user, language) {
    switch (classification) {
      case 'crop_recommendation':
        return await this.handleCropRecommendation(query, user, language);
      case 'harvesting_guidance':
        return await this.handleHarvestingGuidance(query, user, language);
      case 'pest_control':
        return await this.handlePestControl(query, user, language);
      case 'irrigation':
        return await this.handleIrrigation(query, user, language);
      case 'fertilization':
        return await this.handleFertilization(query, user, language);
      case 'weather':
        return await this.handleWeather(query, user, language);
      case 'market_price':
        return await this.handleMarketPrice(query, user, language);
      default:
        return await this.handleGeneralQuery(query, user, language);
    }
  }

  async handleCropRecommendation(query, user, language) {
    try {
      // Extract entities from query; fall back to registered user profile for offline personalization
      const entities = this.extractEntities(query);
      const soilType = entities.soil || this.normalizeSoilTypeForCrop(user.soilType) || 'alluvial';
      const season = entities.season || this.getCurrentSeason();
      const userState = user.location && user.location.state ? user.location.state.trim() : null;

      // Build query: soil + season; optionally filter by user's registered location (preferredLocations)
      const baseQuery = {
        soilTypes: { $in: [soilType] },
        seasons: { $in: [season] },
        isActive: true
      };
      if (userState) {
        baseQuery.$or = [
          { preferredLocations: { $in: [userState] } },
          { preferredLocations: { $exists: true, $size: 0 } },
          { preferredLocations: { $exists: false } }
        ];
      }

      const crops = await Crop.find(baseQuery).limit(5);

      if (crops.length === 0) {
        // Retry without location filter so user still gets some recommendations
        const fallbackCrops = await Crop.find({
          soilTypes: { $in: [soilType] },
          seasons: { $in: [season] },
          isActive: true
        }).limit(5);
        const list = fallbackCrops.length ? fallbackCrops : [];
        const fallbackRecommendations = list.map(crop => ({
          name: crop.localNames[language] || crop.name,
          scientificName: crop.scientificName,
          description: crop.description,
          season: crop.seasons,
          soilTypes: crop.soilTypes,
          marketPrice: crop.marketPrice,
          images: crop.images
        }));
        let fallbackMessage = list.length
          ? getTranslation('cropRecommendation', language) + (userState ? ` (for ${userState}, ${soilType} soil)` : '')
          : 'No suitable crops found for your conditions.';
        if (list.length > 0) {
          fallbackMessage += '\n\n**' + getTranslation('getRecommendation', language) + ':**\n';
          fallbackRecommendations.forEach((c, i) => {
            fallbackMessage += `${i + 1}. **${c.name}**${c.scientificName ? ' (' + c.scientificName + ')' : ''}`;
            if (c.description) fallbackMessage += ' – ' + (c.description.length > 80 ? c.description.slice(0, 80) + '...' : c.description);
            fallbackMessage += '\n';
          });
        }
        return {
          type: 'crop_recommendation',
          message: fallbackMessage,
          crops: fallbackRecommendations,
          season,
          soilType,
          location: userState || undefined
        };
      }

      const cropRecommendations = crops.map(crop => ({
        name: crop.localNames[language] || crop.name,
        scientificName: crop.scientificName,
        description: crop.description,
        season: crop.seasons,
        soilTypes: crop.soilTypes,
        marketPrice: crop.marketPrice,
        images: crop.images
      }));

      // Personalized message with location/soil and full crop list from data
      let message = getTranslation('cropRecommendation', language);
      if (userState || user.soilType) {
        const parts = [];
        if (userState) parts.push(userState);
        if (user.soilType) parts.push(`${user.soilType} soil`);
        message = message + (parts.length ? ` (based on your profile: ${parts.join(', ')})` : '');
      }
      message += '\n\n**' + getTranslation('getRecommendation', language) + ':**\n';
      cropRecommendations.forEach((c, i) => {
        message += `${i + 1}. **${c.name}**${c.scientificName ? ' (' + c.scientificName + ')' : ''}`;
        if (c.description) message += ' – ' + (c.description.length > 80 ? c.description.slice(0, 80) + '...' : c.description);
        message += '\n';
      });

      return {
        type: 'crop_recommendation',
        message,
        crops: cropRecommendations,
        season,
        soilType,
        location: userState || undefined
      };
    } catch (error) {
      return {
        type: 'error',
        message: 'Error processing crop recommendation request.'
      };
    }
  }

  async handleHarvestingGuidance(query, user, language) {
    try {
      const entities = this.extractEntities(query);
      const cropName = entities.crop;

      if (!cropName) {
        return {
          type: 'harvesting_guidance',
          message: 'Please specify which crop you need harvesting guidance for.',
          requiresInput: ['crop']
        };
      }

      // Find crop details
      const crop = await Crop.findOne({
        $or: [
          { name: { $regex: cropName, $options: 'i' } },
          { 'localNames.hindi': { $regex: cropName, $options: 'i' } },
          { 'localNames.telugu': { $regex: cropName, $options: 'i' } },
          { 'localNames.kannada': { $regex: cropName, $options: 'i' } },
          { 'localNames.tamil': { $regex: cropName, $options: 'i' } },
          { 'localNames.malayalam': { $regex: cropName, $options: 'i' } }
        ]
      });

      if (!crop) {
        return {
          type: 'harvesting_guidance',
          message: 'Crop not found. Please check the crop name.',
          crops: []
        };
      }

      const cropLabel = crop.localNames[language] || crop.name;
      const guidance = {
        crop: cropLabel,
        maturityPeriod: crop.harvesting.maturityPeriod,
        indicators: crop.harvesting.indicators,
        method: crop.harvesting.method,
        yield: crop.harvesting.yield,
        steps: [
          getTranslation('planting', language) + ': ' + crop.planting.plantingTime,
          getTranslation('irrigation', language) + ': ' + crop.irrigation.frequency,
          getTranslation('fertilization', language) + ': ' + crop.fertilization.schedule.map(s => s.stage).join(', '),
          getTranslation('harvesting', language) + ': ' + crop.harvesting.method
        ]
      };

      let message = '**' + getTranslation('harvestingGuidance', language) + '** – ' + cropLabel + '\n\n';
      message += '**Maturity:** ' + (crop.harvesting.maturityPeriod || '–') + ' days.\n';
      if (crop.harvesting.indicators && crop.harvesting.indicators.length) {
        message += '**Indicators:** ' + crop.harvesting.indicators.join('; ') + '.\n';
      }
      message += '**Method:** ' + (crop.harvesting.method || '–') + '\n';
      if (guidance.steps.length) message += '\n' + guidance.steps.map((s, i) => (i + 1) + '. ' + s).join('\n');

      return {
        type: 'harvesting_guidance',
        message,
        guidance
      };
    } catch (error) {
      return {
        type: 'error',
        message: 'Error processing harvesting guidance request.'
      };
    }
  }

  async handlePestControl(query, user, language) {
    try {
      const entities = this.extractEntities(query);
      const pestType = entities.pest || entities.disease;

      // Find crops with pest information
      const crops = await Crop.find({
        'pestControl.commonPests': { $exists: true, $ne: [] },
        isActive: true
      }).limit(10);

      const pestInfo = crops.map(crop => ({
        crop: crop.localNames[language] || crop.name,
        pests: crop.pestControl.commonPests,
        pesticides: crop.pestControl.pesticides,
        organicControl: crop.pestControl.organicControl
      }));

      let message = '**' + getTranslation('pestControl', language) + '**\n\n';
      pestInfo.slice(0, 5).forEach((p) => {
        message += '**' + p.crop + '**\n';
        if (p.pests && p.pests.length) message += 'Common pests: ' + p.pests.join(', ') + '.\n';
        if (p.pesticides && p.pesticides.length) {
          message += 'Pesticides: ' + p.pesticides.map((x) => x.name + (x.dosage ? ' (' + x.dosage + ')' : '')).join('; ') + '.\n';
        }
        if (p.organicControl && p.organicControl.length) message += 'Organic: ' + p.organicControl.join('; ') + '.\n';
        message += '\n';
      });

      return {
        type: 'pest_control',
        message: message.trim() || getTranslation('pestControl', language),
        pestInfo,
        searchTerm: pestType
      };
    } catch (error) {
      return {
        type: 'error',
        message: 'Error processing pest control request.'
      };
    }
  }

  async handleIrrigation(query, user, language) {
    try {
      const entities = this.extractEntities(query);
      const cropName = entities.crop;

      if (!cropName) {
        return {
          type: 'irrigation',
          message: 'Please specify which crop you need irrigation guidance for.',
          requiresInput: ['crop']
        };
      }

      const crop = await Crop.findOne({
        $or: [
          { name: { $regex: cropName, $options: 'i' } },
          { 'localNames.hindi': { $regex: cropName, $options: 'i' } },
          { 'localNames.telugu': { $regex: cropName, $options: 'i' } },
          { 'localNames.kannada': { $regex: cropName, $options: 'i' } },
          { 'localNames.tamil': { $regex: cropName, $options: 'i' } },
          { 'localNames.malayalam': { $regex: cropName, $options: 'i' } }
        ]
      });

      if (!crop) {
        return {
          type: 'irrigation',
          message: 'Crop not found. Please check the crop name.',
          irrigation: null
        };
      }

      const cropLabel = crop.localNames[language] || crop.name;
      const schedule = this.generateIrrigationSchedule(crop, user.location);
      const irrigation = {
        crop: cropLabel,
        frequency: crop.irrigation.frequency,
        waterRequirement: crop.irrigation.waterRequirement,
        methods: crop.irrigation.methods,
        schedule
      };

      let message = '**' + getTranslation('irrigation', language) + '** – ' + cropLabel + '\n\n';
      message += '**Frequency:** ' + (crop.irrigation.frequency || '–') + '\n';
      if (crop.irrigation.waterRequirement) message += '**Water requirement:** ' + crop.irrigation.waterRequirement + ' L/plant (approx).\n';
      if (schedule.timing) message += '**Timing:** ' + schedule.timing + '\n';
      if (crop.irrigation.methods && crop.irrigation.methods.length) {
        message += '**Methods:** ' + crop.irrigation.methods.join(', ') + '\n';
      }

      return {
        type: 'irrigation',
        message: (message.trim()) || (getTranslation('irrigation', language) + ' – ' + cropLabel),
        irrigation
      };
    } catch (error) {
      return {
        type: 'error',
        message: 'Error processing irrigation request.'
      };
    }
  }

  async handleFertilization(query, user, language) {
    try {
      const entities = this.extractEntities(query);
      const cropName = entities.crop;

      if (!cropName) {
        return {
          type: 'fertilization',
          message: 'Please specify which crop you need fertilization guidance for.',
          requiresInput: ['crop']
        };
      }

      const crop = await Crop.findOne({
        $or: [
          { name: { $regex: cropName, $options: 'i' } },
          { 'localNames.hindi': { $regex: cropName, $options: 'i' } },
          { 'localNames.telugu': { $regex: cropName, $options: 'i' } },
          { 'localNames.kannada': { $regex: cropName, $options: 'i' } },
          { 'localNames.tamil': { $regex: cropName, $options: 'i' } },
          { 'localNames.malayalam': { $regex: cropName, $options: 'i' } }
        ]
      });

      if (!crop) {
        return {
          type: 'fertilization',
          message: 'Crop not found. Please check the crop name.',
          fertilization: null
        };
      }

      const cropLabel = crop.localNames[language] || crop.name;
      const fertilization = {
        crop: cropLabel,
        npk: crop.fertilization.npk,
        organic: crop.fertilization.organic,
        schedule: crop.fertilization.schedule
      };

      let message = '**' + getTranslation('fertilization', language) + '** – ' + cropLabel + '\n\n';
      if (crop.fertilization.npk && typeof crop.fertilization.npk === 'object') {
        const npk = crop.fertilization.npk;
        message += '**NPK:** N ' + (npk.nitrogen || '–') + ', P ' + (npk.phosphorus || '–') + ', K ' + (npk.potassium || '–') + '.\n';
      }
      if (crop.fertilization.organic && crop.fertilization.organic.length) {
        message += '**Organic:** ' + crop.fertilization.organic.join(', ') + '.\n';
      }
      if (crop.fertilization.schedule && crop.fertilization.schedule.length) {
        message += '**Schedule:**\n' + crop.fertilization.schedule.map((s) => '- ' + (s.stage || '') + ': ' + (s.fertilizer || '') + (s.quantity ? ' ' + s.quantity : '') + (s.timing ? ' (' + s.timing + ')' : '')).join('\n');
      }

      return {
        type: 'fertilization',
        message: message.trim() || getTranslation('fertilization', language),
        fertilization
      };
    } catch (error) {
      return {
        type: 'error',
        message: 'Error processing fertilization request.'
      };
    }
  }

  async handleWeather(query, user, language) {
    const season = this.getCurrentSeason();
    const seasonLabel = getTranslation(season, language) || season;
    const advice = getTranslation('weatherOfflineAdvice', language);
    const message = `${getTranslation('weather', language)}:\n\n${advice}\n\n**${seasonLabel}** – plan accordingly.`;
    return {
      type: 'weather',
      message,
      weather: { season, advice: advice }
    };
  }

  async handleMarketPrice(query, user, language) {
    try {
      const entities = this.extractEntities(query);
      const cropName = entities.crop;

      if (!cropName) {
        return {
          type: 'market_price',
          message: 'Please specify which crop you need market price for.',
          requiresInput: ['crop']
        };
      }

      const crop = await Crop.findOne({
        $or: [
          { name: { $regex: cropName, $options: 'i' } },
          { 'localNames.hindi': { $regex: cropName, $options: 'i' } },
          { 'localNames.telugu': { $regex: cropName, $options: 'i' } },
          { 'localNames.kannada': { $regex: cropName, $options: 'i' } },
          { 'localNames.tamil': { $regex: cropName, $options: 'i' } },
          { 'localNames.malayalam': { $regex: cropName, $options: 'i' } }
        ]
      });

      if (!crop) {
        return {
          type: 'market_price',
          message: 'Crop not found. Please check the crop name.',
          price: null
        };
      }

      const cropLabel = crop.localNames[language] || crop.name;
      const current = crop.marketPrice?.current ?? null;
      const unit = crop.marketPrice?.unit ?? 'per quintal';
      const currency = crop.marketPrice?.currency ?? 'INR';
      let message = '**' + getTranslation('marketPrice', language) + '** – ' + cropLabel + '\n\n';
      if (current != null) {
        message += '**Price:** ' + (currency === 'INR' ? '₹' : '') + current + ' ' + unit + '\n';
      } else {
        message += 'Check local mandi or APMC for current rates.\n';
      }

      return {
        type: 'market_price',
        message: message.trim(),
        price: { crop: cropLabel, current, unit, currency }
      };
    } catch (error) {
      return {
        type: 'error',
        message: 'Error processing market price request.'
      };
    }
  }

  async handleGeneralQuery(query, user, language) {
    return {
      type: 'general',
      message: getTranslation('welcome', language),
      suggestions: [
        getTranslation('cropRecommendation', language),
        getTranslation('harvestingGuidance', language),
        getTranslation('pestControl', language),
        getTranslation('irrigation', language)
      ]
    };
  }

  extractEntities(query) {
    const entities = {};
    const lowerQuery = query.toLowerCase();

    // Extract season
    if (lowerQuery.includes('kharif') || lowerQuery.includes('खरीफ') || lowerQuery.includes('ఖరీఫ్') || 
        lowerQuery.includes('ಖರೀಫ್') || lowerQuery.includes('காரிப்') || lowerQuery.includes('ഖരീഫ്')) {
      entities.season = 'kharif';
    } else if (lowerQuery.includes('rabi') || lowerQuery.includes('रबी') || lowerQuery.includes('రబీ') || 
               lowerQuery.includes('ರಬಿ') || lowerQuery.includes('ரபி') || lowerQuery.includes('റബി')) {
      entities.season = 'rabi';
    } else if (lowerQuery.includes('zaid') || lowerQuery.includes('जायद') || lowerQuery.includes('జైద్') || 
               lowerQuery.includes('ಜೈದ್') || lowerQuery.includes('ஜைத்') || lowerQuery.includes('ജൈദ്')) {
      entities.season = 'zaid';
    }

    // Extract soil type (match Crop schema: black, red, laterite, alluvial, mountain, saline, desert)
    if (lowerQuery.includes('black') || lowerQuery.includes('काली') || lowerQuery.includes('నల్ల')) {
      entities.soil = 'black';
    } else if (lowerQuery.includes('red') || lowerQuery.includes('लाल') || lowerQuery.includes('ఎరుపు')) {
      entities.soil = 'red';
    } else if (lowerQuery.includes('laterite')) {
      entities.soil = 'laterite';
    } else if (lowerQuery.includes('alluvial') || lowerQuery.includes('जलोढ') || lowerQuery.includes('నదీపాత')) {
      entities.soil = 'alluvial';
    } else if (lowerQuery.includes('mountain') || lowerQuery.includes('पहाड')) {
      entities.soil = 'mountain';
    } else if (lowerQuery.includes('saline') || lowerQuery.includes('लवण')) {
      entities.soil = 'saline';
    } else if (lowerQuery.includes('desert') || lowerQuery.includes('रेगिस्तान')) {
      entities.soil = 'desert';
    } else if (lowerQuery.includes('clay') || lowerQuery.includes('चिकनी')) {
      entities.soil = 'black'; // map clay to black
    } else if (lowerQuery.includes('sandy') || lowerQuery.includes('बलुई')) {
      entities.soil = 'alluvial'; // map sandy to alluvial
    } else if (lowerQuery.includes('loamy') || lowerQuery.includes('दोमट')) {
      entities.soil = 'alluvial'; // map loamy to alluvial
    }

    // Extract crop names (simplified)
    const cropKeywords = ['rice', 'wheat', 'maize', 'cotton', 'sugarcane', 'tomato', 'potato', 'onion'];
    for (const crop of cropKeywords) {
      if (lowerQuery.includes(crop)) {
        entities.crop = crop;
        break;
      }
    }

    return entities;
  }

  getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month >= 6 && month <= 10) return 'kharif';
    if (month >= 11 || month <= 3) return 'rabi';
    return 'zaid';
  }

  /**
   * Map user profile soil type to Crop schema canonical values.
   * User can have clay, sandy, loamy, etc.; Crop only has black, red, laterite, alluvial, mountain, saline, desert.
   */
  normalizeSoilTypeForCrop(userSoilType) {
    if (!userSoilType || typeof userSoilType !== 'string') return 'alluvial';
    const v = userSoilType.toLowerCase().trim();
    const canonical = ['black', 'red', 'laterite', 'alluvial', 'mountain', 'saline', 'desert'];
    if (canonical.includes(v)) return v;
    const mapping = { clay: 'black', sandy: 'alluvial', loamy: 'alluvial', silty: 'alluvial', peaty: 'black', chalky: 'laterite' };
    return mapping[v] || 'alluvial';
  }

  generateIrrigationSchedule(crop, location) {
    // Generate irrigation schedule based on crop and location
    return {
      frequency: crop.irrigation.frequency,
      timing: 'Early morning or evening',
      amount: crop.irrigation.waterRequirement + ' liters per plant',
      methods: crop.irrigation.methods
    };
  }

  // Add new training data
  async addTrainingData(text, category, language = 'english') {
    try {
      const newData = {
        text: text,
        category: category,
        language: language,
        timestamp: new Date().toISOString()
      };

      this.trainingData.push(newData);
      await this.saveTrainingData();
      
      // Retrain the classifier
      await this.retrainClassifier();
      
      return { success: true, message: 'Training data added successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Retrain the classifier with updated data
  async retrainClassifier() {
    try {
      this.classifier = new natural.BayesClassifier();
      
      this.trainingData.forEach(item => {
        this.classifier.addDocument(item.text, item.category);
      });

      this.classifier.train();
      this.trained = true;
      console.log('Classifier retrained with', this.trainingData.length, 'samples');
      
      return { success: true, message: 'Classifier retrained successfully' };
    } catch (error) {
      console.error('Error retraining classifier:', error);
      return { success: false, error: error.message };
    }
  }

  // Get training statistics
  getTrainingStats() {
    const stats = {
      totalSamples: this.trainingData.length,
      categories: {},
      languages: {},
      lastUpdated: this.trainingData.length > 0 ? 
        new Date(Math.max(...this.trainingData.map(item => new Date(item.timestamp || 0)))) : null
    };

    this.trainingData.forEach(item => {
      // Count by category
      stats.categories[item.category] = (stats.categories[item.category] || 0) + 1;
      
      // Count by language
      stats.languages[item.language] = (stats.languages[item.language] || 0) + 1;
    });

    return stats;
  }

  // Export training data
  exportTrainingData() {
    return {
      data: this.trainingData,
      stats: this.getTrainingStats(),
      exportDate: new Date().toISOString()
    };
  }

  // Import training data
  async importTrainingData(importData) {
    try {
      if (Array.isArray(importData)) {
        this.trainingData = [...this.trainingData, ...importData];
      } else if (importData.data && Array.isArray(importData.data)) {
        this.trainingData = [...this.trainingData, ...importData.data];
      } else {
        throw new Error('Invalid import data format');
      }

      await this.saveTrainingData();
      await this.retrainClassifier();
      
      return { success: true, message: 'Training data imported successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get model performance metrics
  async getModelPerformance() {
    try {
      const testQueries = [
        { text: 'crop recommendation', expected: 'crop_recommendation' },
        { text: 'harvesting guide', expected: 'harvesting_guidance' },
        { text: 'pest control', expected: 'pest_control' },
        { text: 'irrigation schedule', expected: 'irrigation' },
        { text: 'fertilizer timing', expected: 'fertilization' }
      ];

      let correct = 0;
      let total = testQueries.length;

      testQueries.forEach(test => {
        const prediction = this.classifier.classify(test.text);
        if (prediction === test.expected) {
          correct++;
        }
      });

      const accuracy = (correct / total) * 100;

      return {
        accuracy: accuracy,
        correct: correct,
        total: total,
        model: 'local_classifier',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = AIService;
