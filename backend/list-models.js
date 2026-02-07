// List available Gemini models
// Usage: node list-models.js YOUR_API_KEY

const apiKey = "AIzaSyD8bZKZEnOTWFjrIlIVF7VQSNIXVqdvqdM";

if (!apiKey) {
    console.error('Error: API key required');
    console.error('Usage: node list-models.js YOUR_API_KEY');
    console.error('Or set GEMINI_API_KEY environment variable');
    process.exit(1);
}

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        if (data.error) {
            console.error('API Error:', data.error);
            return;
        }
        
        console.log('\n📋 Available Gemini Models:\n');
        data.models.forEach(model => {
            console.log(`Model: ${model.name}`);
            console.log(`  Display Name: ${model.displayName || 'N/A'}`);
            console.log(`  Supported Methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`);
            console.log('');
        });
        
        console.log('\n💡 Models that support generateContent:');
        data.models
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .forEach(m => console.log(`  - ${m.name}`));
            
    } catch (error) {
        console.error('Error fetching models:', error.message);
    }
}

listModels();
