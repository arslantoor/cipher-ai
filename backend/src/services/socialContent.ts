import { GoogleGenerativeAI } from '@google/generative-ai';
import { TradingInsight, SocialContent } from '../types';
import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from './audit';

type Persona = 'calm_analyst' | 'data_explainer' | 'trading_coach';
type Platform = 'linkedin' | 'x' | 'thread';

export class SocialContentGenerator {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY || '';
        this.genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        this.model = this.genAI.getGenerativeModel({ model: modelName });
    }

    /**
     * Generate social content for an insight
     */
    async generateContent(insight: TradingInsight): Promise<SocialContent[]> {
        const contents: SocialContent[] = [];

        // Generate for each platform and persona combination
        const platforms: Platform[] = ['linkedin', 'x', 'thread'];
        const personas: Persona[] = ['calm_analyst', 'data_explainer', 'trading_coach'];

        for (const platform of platforms) {
            for (const persona of personas) {
                try {
                    const content = await this.generatePlatformContent(insight, platform, persona);
                    contents.push(content);
                    this.storeContent(content);
                } catch (error) {
                    console.error(`Failed to generate ${platform} content with ${persona}:`, error);
                }
            }
        }

        AuditService.log({
            action: 'SOCIAL_CONTENT_GENERATED',
            resource_type: 'trading_insight',
            resource_id: insight.insight_id,
            details: JSON.stringify({
                platform_count: platforms.length,
                persona_count: personas.length,
                total_content: contents.length,
            }),
        });

        return contents;
    }

    private async generatePlatformContent(
        insight: TradingInsight,
        platform: Platform,
        persona: Persona
    ): Promise<SocialContent> {
        if (!process.env.GEMINI_API_KEY) {
            return this.getFallbackContent(insight, platform, persona);
        }

        const prompt = this.buildSocialPrompt(insight, platform, persona);

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            return {
                insight_id: insight.insight_id,
                platform,
                content,
                persona,
                generated_at: new Date().toISOString(),
            };
        } catch (error) {
            console.error(`Gemini social content generation error for ${platform}/${persona}:`, error);
            return this.getFallbackContent(insight, platform, persona);
        }
    }

    private buildSocialPrompt(insight: TradingInsight, platform: Platform, persona: Persona): string {
        const personaGuidance = this.getPersonaGuidance(persona);
        const platformGuidance = this.getPlatformGuidance(platform);

        return `${personaGuidance}

${platformGuidance}

TRADING INSIGHT DATA:
- Instrument: ${insight.instrument}
- Market Movement: ${insight.market_context.movementType} (${insight.market_context.magnitude.toFixed(2)}%)
- Behavioral Pressure: ${insight.pressure_level} (score: ${insight.behaviour_context.pressure_score.score}/100)
- Market Context: ${insight.market_context.historicalContext}
- Narrative: ${insight.narrative?.substring(0, 200)}...

CRITICAL RULES:
1. NO trading predictions, price forecasts, or buy/sell signals
2. NO recommendations to enter/exit trades
3. NO financial advice
4. Educational, brand-safe language only
5. NO hype or sensationalism
6. Focus on insights and patterns observed
7. NO call-to-action beyond education

CONTENT QUALITY REQUIREMENTS (CRITICAL):
- Write like a REAL person, not an AI. Use natural language, conversational flow.
- Make it compelling enough that followers won't realize it's AI-generated
- Include subtle personality quirks, natural phrasing, human-like observations
- Avoid: repetitive patterns, overly perfect grammar, corporate speak, marketing language
- Use: natural transitions, occasional questions, genuine curiosity, authentic voice
- Each persona should have a distinct voice that feels consistent and human
- Make content shareable because it's genuinely interesting, not because it's optimized

Generate ${platform === 'thread' ? '3-5 posts (numbered 1/5, 2/5, etc.)' : 'a single post'} that explains the trading insight in an educational, non-advisory manner. The content must feel authentic, human, and compelling - like a real trading analyst sharing insights, not AI-generated content.`;
    }

    private getPersonaGuidance(persona: Persona): string {
        const personas = {
            calm_analyst: `Persona: Calm Analyst (Dr. Sarah Chen)
- Professional, measured tone with subtle warmth
- Data-driven observations with human context
- Objective analysis that feels conversational, not robotic
- Use natural transitions: "Here's what caught my attention...", "What's interesting is..."
- Share insights as if talking to a colleague, not a report
- Include subtle personality: occasional thoughtful questions, gentle observations
- Write like a trusted market analyst who genuinely cares about trader education
- Avoid: corporate jargon, overly formal language, bullet points that feel AI-generated`,
            data_explainer: `Persona: Data Explainer (Alex Rivera)
- Focus on numbers and patterns, but make them relatable
- Clear, technical explanations with real-world context
- Visualize data insights using emojis naturally: 📊 📈 📉 (not excessive)
- Educational approach that feels like teaching a friend
- Use analogies and comparisons to make data accessible
- Show enthusiasm for interesting patterns: "This is fascinating..." 
- Write like a data scientist who loves explaining complex things simply
- Avoid: dry statistics, overwhelming numbers, robotic data dumps`,
            trading_coach: `Persona: Trading Coach (Marcus Thompson)
- Educational, supportive tone that feels genuine
- Pattern recognition focus with personal touch
- Behavioral insights shared like life lessons
- Learning-oriented with encouragement
- Use coaching language: "I've noticed...", "Many traders find...", "Here's something to consider..."
- Share insights as if you've seen this pattern before and want to help
- Write like an experienced coach who's seen it all and wants to help others succeed
- Avoid: preachy tone, generic advice, condescending language`,
        };
        return personas[persona];
    }

    private getPlatformGuidance(platform: Platform): string {
        const platforms = {
            linkedin: `Platform: LinkedIn
- Professional but conversational tone (not corporate-speak)
- 200-300 words with natural flow
- Educational content that reads like a thoughtful post from a real analyst
- Start with a hook: question, observation, or interesting fact
- Use paragraph breaks naturally, not forced formatting
- End with a thoughtful question or insight that invites engagement
- Write like a real person sharing expertise, not a content marketing bot
- Include subtle personality markers that make it feel human`,
            x: `Platform: X (Twitter)
- Concise, sharp insights with personality
- 150-280 characters (stay under limit)
- Insight-led but feels spontaneous, not templated
- Engaging but professional - like a real trader sharing thoughts
- Use natural language, not marketing copy
- Can include one relevant emoji if it feels natural (not forced)
- Write like you're sharing a quick thought, not a scheduled post
- Make it feel like a real person's observation, not AI-generated content`,
            thread: `Platform: X Thread
- 3-5 connected posts that tell a story
- Each 200-280 characters
- Progressive narrative that builds naturally
- Educational thread that feels like a real analyst explaining something
- Each post should flow naturally to the next
- Use numbering (1/5, 2/5) but make content feel organic
- Write like you're live-tweeting an analysis, not generating a script
- Make it compelling enough that people don't realize it's AI`,
        };
        return platforms[platform];
    }

    private getFallbackContent(insight: TradingInsight, platform: Platform, persona: Persona): SocialContent {
        const baseContent = `Analysis of ${insight.instrument}: ${insight.market_context.movementType} movement observed. Behavioral pressure: ${insight.pressure_level}. Patterns detected in trading activity. Educational insight - no trading advice.`;

        let content = baseContent;
        if (platform === 'x') {
            content = content.substring(0, 280);
        } else if (platform === 'thread') {
            content = `1/3 ${content.substring(0, 200)}\n\n2/3 Market context: ${insight.market_context.historicalContext.substring(0, 200)}\n\n3/3 Behavioral patterns: ${insight.pressure_level} pressure level observed.`;
        }

        return {
            insight_id: insight.insight_id,
            platform,
            content,
            persona,
            generated_at: new Date().toISOString(),
        };
    }

    private storeContent(content: SocialContent): void {
        const stmt = db.prepare(`
            INSERT INTO social_content (
                id, insight_id, platform, content, persona, generated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            uuidv4(),
            content.insight_id,
            content.platform,
            content.content,
            content.persona,
            content.generated_at
        );
    }

    /**
     * Get social content for an insight
     */
    static getContent(insightId: string, platform?: Platform, persona?: Persona): SocialContent[] {
        let query = 'SELECT * FROM social_content WHERE insight_id = ?';
        const params: any[] = [insightId];

        if (platform) {
            query += ' AND platform = ?';
            params.push(platform);
        }

        if (persona) {
            query += ' AND persona = ?';
            params.push(persona);
        }

        query += ' ORDER BY generated_at DESC';

        const stmt = db.prepare(query);
        const rows = stmt.all(...params) as any[];

        return rows.map(row => ({
            insight_id: row.insight_id,
            platform: row.platform,
            content: row.content,
            persona: row.persona,
            generated_at: row.generated_at,
        }));
    }
}