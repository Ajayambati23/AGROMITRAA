const mongoose = require('mongoose');
const Crop = require('../models/Crop');
require('dotenv').config();

const sampleCrops = [
  {
    name: "Rice",
    scientificName: "Oryza sativa",
    localNames: {
      hindi: "चावल",
      telugu: "వరి",
      kannada: "ಅಕ್ಕಿ",
      tamil: "அரிசி",
      malayalam: "അരി"
    },
    description: "Rice is the most important staple food crop in India, providing food security to more than 60% of the population. It is grown in diverse agro-climatic conditions across the country.",
    seasons: ["kharif", "rabi"],
    soilTypes: ["black", "alluvial", "laterite"],
    preferredLocations: ["West Bengal", "Tamil Nadu", "Andhra Pradesh", "Punjab"],
    climate: {
      temperature: { min: 20, max: 35 },
      rainfall: { min: 1000, max: 2000 },
      humidity: { min: 70, max: 90 }
    },
    planting: {
      spacing: { row: 20, plant: 15 },
      depth: 2,
      seedRate: 40,
      plantingTime: "June-July for Kharif, November-December for Rabi"
    },
    irrigation: {
      frequency: "Every 3-4 days",
      waterRequirement: 1200,
      methods: ["Flood irrigation", "Drip irrigation", "Sprinkler irrigation"]
    },
    fertilization: {
      npk: { nitrogen: 120, phosphorus: 60, potassium: 60 },
      organic: ["Farmyard manure", "Compost", "Green manure"],
      schedule: [
        { stage: "Basal", fertilizer: "NPK 20:20:20", quantity: "50 kg/acre", timing: "At planting" },
        { stage: "Tillering", fertilizer: "Urea", quantity: "25 kg/acre", timing: "25-30 days after planting" },
        { stage: "Panicle initiation", fertilizer: "Urea", quantity: "25 kg/acre", timing: "45-50 days after planting" }
      ]
    },
    pestControl: {
      commonPests: ["Brown plant hopper", "Stem borer", "Leaf folder", "Rice hispa"],
      pesticides: [
        { name: "Imidacloprid", activeIngredient: "Imidacloprid 17.8% SL", dosage: "0.5 ml/liter", application: "Foliar spray", safetyPeriod: 7 },
        { name: "Chlorpyriphos", activeIngredient: "Chlorpyriphos 20% EC", dosage: "2 ml/liter", application: "Foliar spray", safetyPeriod: 14 }
      ],
      organicControl: ["Neem oil spray", "Garlic extract", "Chili extract", "Biological control agents"]
    },
    harvesting: {
      maturityPeriod: 120,
      indicators: ["Grains turn golden yellow", "Moisture content 20-22%", "85% of grains mature"],
      method: "Cut with sickle or combine harvester",
      yield: { min: 3000, max: 6000, unit: "kg/acre" }
    },
    marketPrice: {
      current: 2500,
      unit: "per quintal",
      currency: "INR"
    },
    images: ["rice_field.jpg", "rice_grains.jpg"],
    isActive: true
  },
  {
    name: "Wheat",
    scientificName: "Triticum aestivum",
    localNames: {
      hindi: "गेहूं",
      telugu: "గోధుమలు",
      kannada: "ಗೋಧಿ",
      tamil: "கோதுமை",
      malayalam: "ഗോതമ്പ്"
    },
    description: "Wheat is a major cereal crop grown in temperate regions. It is a winter crop that requires cool temperatures during growth.",
    seasons: ["rabi"],
    soilTypes: ["alluvial", "black", "red"],
    preferredLocations: ["Punjab", "Haryana", "Uttar Pradesh"],
    climate: {
      temperature: { min: 15, max: 25 },
      rainfall: { min: 500, max: 1000 },
      humidity: { min: 50, max: 70 }
    },
    planting: {
      spacing: { row: 22, plant: 10 },
      depth: 3,
      seedRate: 40,
      plantingTime: "October-November"
    },
    irrigation: {
      frequency: "Every 7-10 days",
      waterRequirement: 400,
      methods: ["Flood irrigation", "Drip irrigation", "Sprinkler irrigation"]
    },
    fertilization: {
      npk: { nitrogen: 100, phosphorus: 50, potassium: 40 },
      organic: ["Farmyard manure", "Compost", "Vermicompost"],
      schedule: [
        { stage: "Basal", fertilizer: "NPK 20:20:20", quantity: "40 kg/acre", timing: "At planting" },
        { stage: "Tillering", fertilizer: "Urea", quantity: "20 kg/acre", timing: "25-30 days after planting" },
        { stage: "Flowering", fertilizer: "Urea", quantity: "20 kg/acre", timing: "60-65 days after planting" }
      ]
    },
    pestControl: {
      commonPests: ["Aphids", "Army worm", "Cut worm", "Termites"],
      pesticides: [
        { name: "Acephate", activeIngredient: "Acephate 75% SP", dosage: "1.5 g/liter", application: "Foliar spray", safetyPeriod: 7 },
        { name: "Chlorpyriphos", activeIngredient: "Chlorpyriphos 20% EC", dosage: "2 ml/liter", application: "Soil application", safetyPeriod: 14 }
      ],
      organicControl: ["Neem oil spray", "Garlic extract", "Biological control agents", "Crop rotation"]
    },
    harvesting: {
      maturityPeriod: 120,
      indicators: ["Grains turn golden brown", "Moisture content 12-14%", "Straw turns yellow"],
      method: "Combine harvester or manual cutting",
      yield: { min: 2500, max: 4500, unit: "kg/acre" }
    },
    marketPrice: {
      current: 2200,
      unit: "per quintal",
      currency: "INR"
    },
    images: ["wheat_field.jpg", "wheat_grains.jpg"],
    isActive: true
  },
  {
    name: "Maize",
    scientificName: "Zea mays",
    localNames: {
      hindi: "मक्का",
      telugu: "మొక్కజొన్న",
      kannada: "ಮೆಕ್ಕೆಜೋಳ",
      tamil: "சோளம்",
      malayalam: "ചോളം"
    },
    description: "Maize is a versatile crop used for food, feed, and industrial purposes. It is a warm-season crop that grows well in various soil types.",
    seasons: ["kharif", "rabi"],
    soilTypes: ["alluvial", "red", "black"],
    preferredLocations: ["Rajasthan", "Madhya Pradesh", "Uttar Pradesh"],
    climate: {
      temperature: { min: 18, max: 30 },
      rainfall: { min: 600, max: 1200 },
      humidity: { min: 60, max: 80 }
    },
    planting: {
      spacing: { row: 60, plant: 25 },
      depth: 3,
      seedRate: 20,
      plantingTime: "June-July for Kharif, October-November for Rabi"
    },
    irrigation: {
      frequency: "Every 5-7 days",
      waterRequirement: 500,
      methods: ["Drip irrigation", "Sprinkler irrigation", "Flood irrigation"]
    },
    fertilization: {
      npk: { nitrogen: 120, phosphorus: 60, potassium: 60 },
      organic: ["Farmyard manure", "Compost", "Green manure"],
      schedule: [
        { stage: "Basal", fertilizer: "NPK 20:20:20", quantity: "50 kg/acre", timing: "At planting" },
        { stage: "Knee high", fertilizer: "Urea", quantity: "30 kg/acre", timing: "25-30 days after planting" },
        { stage: "Tasseling", fertilizer: "Urea", quantity: "20 kg/acre", timing: "45-50 days after planting" }
      ]
    },
    pestControl: {
      commonPests: ["Fall armyworm", "Stem borer", "Aphids", "Thrips"],
      pesticides: [
        { name: "Emamectin benzoate", activeIngredient: "Emamectin benzoate 5% SG", dosage: "0.5 g/liter", application: "Foliar spray", safetyPeriod: 7 },
        { name: "Spinosad", activeIngredient: "Spinosad 45% SC", dosage: "0.3 ml/liter", application: "Foliar spray", safetyPeriod: 3 }
      ],
      organicControl: ["Neem oil spray", "Bacillus thuringiensis", "Trichogramma wasps", "Crop rotation"]
    },
    harvesting: {
      maturityPeriod: 90,
      indicators: ["Husks turn brown", "Kernels harden", "Moisture content 20-25%"],
      method: "Combine harvester or manual picking",
      yield: { min: 2000, max: 4000, unit: "kg/acre" }
    },
    marketPrice: {
      current: 1800,
      unit: "per quintal",
      currency: "INR"
    },
    images: ["maize_field.jpg", "maize_cobs.jpg"],
    isActive: true
  },
  {
    name: "Cotton",
    scientificName: "Gossypium hirsutum",
    localNames: {
      hindi: "कपास",
      telugu: "పత్తి",
      kannada: "ಹತ್ತಿ",
      tamil: "பருத்தி",
      malayalam: "പരുത്തി"
    },
    description: "Cotton is a fiber crop grown for its soft, fluffy fiber. It is a warm-season crop that requires long growing season and adequate moisture.",
    seasons: ["kharif"],
    soilTypes: ["black", "red", "alluvial"],
    preferredLocations: ["Maharashtra", "Gujarat", "Telangana", "Andhra Pradesh"],
    climate: {
      temperature: { min: 20, max: 35 },
      rainfall: { min: 500, max: 1000 },
      humidity: { min: 50, max: 70 }
    },
    planting: {
      spacing: { row: 90, plant: 45 },
      depth: 2,
      seedRate: 4,
      plantingTime: "May-June"
    },
    irrigation: {
      frequency: "Every 10-15 days",
      waterRequirement: 600,
      methods: ["Drip irrigation", "Flood irrigation", "Sprinkler irrigation"]
    },
    fertilization: {
      npk: { nitrogen: 80, phosphorus: 40, potassium: 40 },
      organic: ["Farmyard manure", "Compost", "Green manure"],
      schedule: [
        { stage: "Basal", fertilizer: "NPK 20:20:20", quantity: "40 kg/acre", timing: "At planting" },
        { stage: "Square formation", fertilizer: "Urea", quantity: "25 kg/acre", timing: "40-45 days after planting" },
        { stage: "Flowering", fertilizer: "Urea", quantity: "15 kg/acre", timing: "60-65 days after planting" }
      ]
    },
    pestControl: {
      commonPests: ["Bollworm", "Aphids", "Whitefly", "Thrips", "Jassids"],
      pesticides: [
        { name: "Monocrotophos", activeIngredient: "Monocrotophos 36% SL", dosage: "1.5 ml/liter", application: "Foliar spray", safetyPeriod: 7 },
        { name: "Acephate", activeIngredient: "Acephate 75% SP", dosage: "1 g/liter", application: "Foliar spray", safetyPeriod: 7 }
      ],
      organicControl: ["Neem oil spray", "Bacillus thuringiensis", "Trichogramma wasps", "Crop rotation"]
    },
    harvesting: {
      maturityPeriod: 150,
      indicators: ["Bolls open", "Fiber mature", "Leaves turn yellow"],
      method: "Manual picking or mechanical harvesting",
      yield: { min: 400, max: 800, unit: "kg/acre" }
    },
    marketPrice: {
      current: 6000,
      unit: "per quintal",
      currency: "INR"
    },
    images: ["cotton_field.jpg", "cotton_bolls.jpg"],
    isActive: true
  },
  {
    name: "Sugarcane",
    scientificName: "Saccharum officinarum",
    localNames: {
      hindi: "गन्ना",
      telugu: "చెరకు",
      kannada: "ಕಬ್ಬು",
      tamil: "கரும்பு",
      malayalam: "കരിമ്പ്"
    },
    description: "Sugarcane is a tall perennial grass grown for sugar production. It requires tropical or subtropical climate with adequate rainfall.",
    seasons: ["year-round"],
    soilTypes: ["alluvial", "black", "red"],
    preferredLocations: ["Maharashtra", "Karnataka", "Tamil Nadu"],
    climate: {
      temperature: { min: 20, max: 35 },
      rainfall: { min: 1000, max: 2000 },
      humidity: { min: 60, max: 80 }
    },
    planting: {
      spacing: { row: 90, plant: 30 },
      depth: 5,
      seedRate: 35000,
      plantingTime: "October-March"
    },
    irrigation: {
      frequency: "Every 7-10 days",
      waterRequirement: 1500,
      methods: ["Furrow irrigation", "Drip irrigation", "Flood irrigation"]
    },
    fertilization: {
      npk: { nitrogen: 200, phosphorus: 100, potassium: 100 },
      organic: ["Farmyard manure", "Compost", "Press mud"],
      schedule: [
        { stage: "Basal", fertilizer: "NPK 20:20:20", quantity: "100 kg/acre", timing: "At planting" },
        { stage: "Tillering", fertilizer: "Urea", quantity: "50 kg/acre", timing: "60-70 days after planting" },
        { stage: "Grand growth", fertilizer: "Urea", quantity: "50 kg/acre", timing: "120-130 days after planting" }
      ]
    },
    pestControl: {
      commonPests: ["Top borer", "Stem borer", "Root borer", "White grub"],
      pesticides: [
        { name: "Chlorpyriphos", activeIngredient: "Chlorpyriphos 20% EC", dosage: "3 ml/liter", application: "Soil application", safetyPeriod: 14 },
        { name: "Carbofuran", activeIngredient: "Carbofuran 3% G", dosage: "25 kg/acre", application: "Soil application", safetyPeriod: 21 }
      ],
      organicControl: ["Neem cake", "Biological control agents", "Crop rotation", "Intercropping"]
    },
    harvesting: {
      maturityPeriod: 365,
      indicators: ["Canes mature", "Sugar content 12-14%", "Leaves turn yellow"],
      method: "Manual cutting with machete",
      yield: { min: 40000, max: 80000, unit: "kg/acre" }
    },
    marketPrice: {
      current: 3000,
      unit: "per ton",
      currency: "INR"
    },
    images: ["sugarcane_field.jpg", "sugarcane_stalks.jpg"],
    isActive: true
  },
  {
    name: "Tomato",
    scientificName: "Solanum lycopersicum",
    localNames: {
      hindi: "टमाटर",
      telugu: "టమాట",
      kannada: "ಟೊಮಾಟೊ",
      tamil: "தக்காளி",
      malayalam: "തക്കാളി"
    },
    description: "Tomato is one of the most important vegetable crops grown worldwide. It is rich in vitamins A and C and is used in various culinary preparations.",
    seasons: ["year-round"],
    soilTypes: ["alluvial", "red", "black"],
    preferredLocations: ["Karnataka", "Tamil Nadu", "Telangana"],
    climate: {
      temperature: { min: 15, max: 30 },
      rainfall: { min: 400, max: 800 },
      humidity: { min: 60, max: 80 }
    },
    planting: {
      spacing: { row: 60, plant: 45 },
      depth: 1,
      seedRate: 0.5,
      plantingTime: "October-November for winter crop, June-July for summer crop"
    },
    irrigation: {
      frequency: "Every 2-3 days",
      waterRequirement: 400,
      methods: ["Drip irrigation", "Furrow irrigation", "Sprinkler irrigation"]
    },
    fertilization: {
      npk: { nitrogen: 80, phosphorus: 40, potassium: 60 },
      organic: ["Farmyard manure", "Vermicompost", "Neem cake"],
      schedule: [
        { stage: "Basal", fertilizer: "NPK 20:20:20", quantity: "30 kg/acre", timing: "At planting" },
        { stage: "Vegetative", fertilizer: "Urea", quantity: "20 kg/acre", timing: "30 days after planting" },
        { stage: "Flowering", fertilizer: "Urea", quantity: "15 kg/acre", timing: "60 days after planting" }
      ]
    },
    pestControl: {
      commonPests: ["Fruit borer", "Whitefly", "Aphids", "Thrips"],
      pesticides: [
        { name: "Spinosad", activeIngredient: "Spinosad 45% SC", dosage: "0.3 ml/liter", application: "Foliar spray", safetyPeriod: 3 },
        { name: "Acephate", activeIngredient: "Acephate 75% SP", dosage: "1 g/liter", application: "Foliar spray", safetyPeriod: 7 }
      ],
      organicControl: ["Neem oil spray", "Bacillus thuringiensis", "Trichogramma wasps", "Yellow sticky traps"]
    },
    harvesting: {
      maturityPeriod: 90,
      indicators: ["Fruits turn red", "Firm texture", "Proper size achieved"],
      method: "Manual picking when fruits are mature",
      yield: { min: 15000, max: 25000, unit: "kg/acre" }
    },
    marketPrice: {
      current: 40,
      unit: "per kg",
      currency: "INR"
    },
    images: ["tomato_plant.jpg", "tomato_fruits.jpg"],
    isActive: true
  },
  {
    name: "Potato",
    scientificName: "Solanum tuberosum",
    localNames: {
      hindi: "आलू",
      telugu: "ఆలుగడ్డ",
      kannada: "ಆಲೂಗಡ್ಡೆ",
      tamil: "உருளைக்கிழங்கு",
      malayalam: "ഉരുളക്കിഴങ്ങ്"
    },
    description: "Potato is a major food crop and the world's fourth-largest food crop. It is rich in carbohydrates and provides essential nutrients.",
    seasons: ["rabi", "kharif"],
    soilTypes: ["alluvial", "red", "black"],
    preferredLocations: ["Punjab", "Uttar Pradesh", "Bihar"],
    climate: {
      temperature: { min: 10, max: 25 },
      rainfall: { min: 300, max: 600 },
      humidity: { min: 50, max: 70 }
    },
    planting: {
      spacing: { row: 45, plant: 20 },
      depth: 5,
      seedRate: 2000,
      plantingTime: "October-November for Rabi, June-July for Kharif"
    },
    irrigation: {
      frequency: "Every 5-7 days",
      waterRequirement: 500,
      methods: ["Furrow irrigation", "Drip irrigation", "Sprinkler irrigation"]
    },
    fertilization: {
      npk: { nitrogen: 100, phosphorus: 50, potassium: 80 },
      organic: ["Farmyard manure", "Compost", "Green manure"],
      schedule: [
        { stage: "Basal", fertilizer: "NPK 20:20:20", quantity: "40 kg/acre", timing: "At planting" },
        { stage: "Earthing up", fertilizer: "Urea", quantity: "25 kg/acre", timing: "45 days after planting" },
        { stage: "Tuber formation", fertilizer: "Urea", quantity: "15 kg/acre", timing: "60 days after planting" }
      ]
    },
    pestControl: {
      commonPests: ["Colorado beetle", "Aphids", "Cutworms", "Wireworms"],
      pesticides: [
        { name: "Imidacloprid", activeIngredient: "Imidacloprid 17.8% SL", dosage: "0.5 ml/liter", application: "Soil application", safetyPeriod: 7 },
        { name: "Chlorpyriphos", activeIngredient: "Chlorpyriphos 20% EC", dosage: "2 ml/liter", application: "Soil application", safetyPeriod: 14 }
      ],
      organicControl: ["Neem cake", "Biological control agents", "Crop rotation", "Intercropping"]
    },
    harvesting: {
      maturityPeriod: 100,
      indicators: ["Leaves turn yellow", "Tubers mature", "Skin sets properly"],
      method: "Manual digging or mechanical harvester",
      yield: { min: 20000, max: 35000, unit: "kg/acre" }
    },
    marketPrice: {
      current: 25,
      unit: "per kg",
      currency: "INR"
    },
    images: ["potato_field.jpg", "potato_tubers.jpg"],
    isActive: true
  },
  {
    name: "Onion",
    scientificName: "Allium cepa",
    localNames: {
      hindi: "प्याज",
      telugu: "ఉల్లి",
      kannada: "ಈರುಳ್ಳಿ",
      tamil: "வெங்காயம்",
      malayalam: "ഉള്ളി"
    },
    description: "Onion is an important commercial crop and a key ingredient in Indian cuisine. It is grown for its bulbs which are used as a vegetable and spice.",
    seasons: ["rabi", "kharif"],
    soilTypes: ["alluvial", "red", "black"],
    preferredLocations: ["Maharashtra", "Karnataka", "Madhya Pradesh"],
    climate: {
      temperature: { min: 15, max: 30 },
      rainfall: { min: 400, max: 800 },
      humidity: { min: 60, max: 80 }
    },
    planting: {
      spacing: { row: 30, plant: 10 },
      depth: 2,
      seedRate: 4,
      plantingTime: "October-November for Rabi, June-July for Kharif"
    },
    irrigation: {
      frequency: "Every 3-4 days",
      waterRequirement: 350,
      methods: ["Drip irrigation", "Furrow irrigation", "Sprinkler irrigation"]
    },
    fertilization: {
      npk: { nitrogen: 60, phosphorus: 30, potassium: 40 },
      organic: ["Farmyard manure", "Compost", "Vermicompost"],
      schedule: [
        { stage: "Basal", fertilizer: "NPK 20:20:20", quantity: "25 kg/acre", timing: "At planting" },
        { stage: "Vegetative", fertilizer: "Urea", quantity: "15 kg/acre", timing: "30 days after planting" },
        { stage: "Bulb formation", fertilizer: "Urea", quantity: "10 kg/acre", timing: "60 days after planting" }
      ]
    },
    pestControl: {
      commonPests: ["Thrips", "Aphids", "Onion maggot", "Cutworms"],
      pesticides: [
        { name: "Acephate", activeIngredient: "Acephate 75% SP", dosage: "1 g/liter", application: "Foliar spray", safetyPeriod: 7 },
        { name: "Imidacloprid", activeIngredient: "Imidacloprid 17.8% SL", dosage: "0.5 ml/liter", application: "Foliar spray", safetyPeriod: 7 }
      ],
      organicControl: ["Neem oil spray", "Garlic extract", "Biological control agents", "Crop rotation"]
    },
    harvesting: {
      maturityPeriod: 120,
      indicators: ["Leaves turn yellow and droop", "Bulbs mature", "Neck becomes soft"],
      method: "Manual pulling or mechanical harvester",
      yield: { min: 15000, max: 25000, unit: "kg/acre" }
    },
    marketPrice: {
      current: 30,
      unit: "per kg",
      currency: "INR"
    },
    images: ["onion_field.jpg", "onion_bulbs.jpg"],
    isActive: true
  },
  {
    name: "Chili",
    scientificName: "Capsicum annuum",
    localNames: {
      hindi: "मिर्च",
      telugu: "మిరపకాయ",
      kannada: "ಮೆಣಸಿನಕಾಯಿ",
      tamil: "மிளகாய்",
      malayalam: "മുളക്"
    },
    description: "Chili is an important spice crop grown for its pungent fruits. It is widely used in Indian cuisine and has high export value.",
    seasons: ["year-round"],
    soilTypes: ["alluvial", "red", "black"],
    preferredLocations: ["Telangana", "Andhra Pradesh", "Karnataka"],
    climate: {
      temperature: { min: 20, max: 30 },
      rainfall: { min: 500, max: 1000 },
      humidity: { min: 60, max: 80 }
    },
    planting: {
      spacing: { row: 45, plant: 30 },
      depth: 1,
      seedRate: 0.5,
      plantingTime: "October-November for winter crop, June-July for summer crop"
    },
    irrigation: {
      frequency: "Every 3-4 days",
      waterRequirement: 300,
      methods: ["Drip irrigation", "Furrow irrigation", "Sprinkler irrigation"]
    },
    fertilization: {
      npk: { nitrogen: 60, phosphorus: 30, potassium: 40 },
      organic: ["Farmyard manure", "Compost", "Neem cake"],
      schedule: [
        { stage: "Basal", fertilizer: "NPK 20:20:20", quantity: "25 kg/acre", timing: "At planting" },
        { stage: "Vegetative", fertilizer: "Urea", quantity: "15 kg/acre", timing: "30 days after planting" },
        { stage: "Flowering", fertilizer: "Urea", quantity: "10 kg/acre", timing: "60 days after planting" }
      ]
    },
    pestControl: {
      commonPests: ["Fruit borer", "Thrips", "Aphids", "Mites"],
      pesticides: [
        { name: "Spinosad", activeIngredient: "Spinosad 45% SC", dosage: "0.3 ml/liter", application: "Foliar spray", safetyPeriod: 3 },
        { name: "Acephate", activeIngredient: "Acephate 75% SP", dosage: "1 g/liter", application: "Foliar spray", safetyPeriod: 7 }
      ],
      organicControl: ["Neem oil spray", "Bacillus thuringiensis", "Trichogramma wasps", "Yellow sticky traps"]
    },
    harvesting: {
      maturityPeriod: 90,
      indicators: ["Fruits turn red", "Firm texture", "Proper pungency"],
      method: "Manual picking when fruits are mature",
      yield: { min: 8000, max: 15000, unit: "kg/acre" }
    },
    marketPrice: {
      current: 120,
      unit: "per kg",
      currency: "INR"
    },
    images: ["chili_plant.jpg", "chili_fruits.jpg"],
    isActive: true
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agromitra');
    console.log('Connected to MongoDB');

    // Clear existing crops
    await Crop.deleteMany({});
    console.log('Cleared existing crops');

    // Insert sample crops
    await Crop.insertMany(sampleCrops);
    console.log('Inserted sample crops');

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seeding function
seedDatabase();
