// Agent Manager - Manages all agents lifecycle
import { FraudDetectionAgent } from './fraudDetectionAgent';
import { OrchestratorAgent } from './orchestratorAgent';
import { ReportGenerationAgent } from './reportGenerationAgent';
import { SupervisorAgent } from './supervisorAgent';
import { InvestigationReportAgent } from './investigationReportAgent';
import { BaseAgent } from './baseAgent';
import { db } from '../config/database';

export class AgentManager {
    private agents: Map<string, BaseAgent> = new Map();

    /**
     * Start all agents
     */
    async startAllAgents(): Promise<void> {
        console.log('[AgentManager] Starting all agents...');

        const fraudAgent = new FraudDetectionAgent();
        const orchestratorAgent = new OrchestratorAgent();
        const reportAgent = new ReportGenerationAgent();
        const supervisorAgent = new SupervisorAgent();
        const investigationReportAgent = new InvestigationReportAgent();

        await fraudAgent.start();
        await orchestratorAgent.start();
        await reportAgent.start();
        await supervisorAgent.start();
        await investigationReportAgent.start();

        this.agents.set('fraud_detection', fraudAgent);
        this.agents.set('orchestrator', orchestratorAgent);
        this.agents.set('report_generation', reportAgent);
        this.agents.set('supervisor', supervisorAgent);
        this.agents.set('investigation_report', investigationReportAgent);

        console.log('[AgentManager] All agents started');
    }

    /**
     * Stop all agents
     */
    async stopAllAgents(): Promise<void> {
        console.log('[AgentManager] Stopping all agents...');

        const stopPromises = Array.from(this.agents.values()).map(agent => agent.stop());
        await Promise.all(stopPromises);

        this.agents.clear();
        console.log('[AgentManager] All agents stopped');
    }

    /**
     * Get agent by type
     */
    getAgent(agentType: string): BaseAgent | undefined {
        return this.agents.get(agentType);
    }

    /**
     * Get all agents
     */
    getAllAgents(): BaseAgent[] {
        return Array.from(this.agents.values());
    }

    /**
     * Get agent status
     */
    getAgentStatus(): Array<{ type: string; id: string; running: boolean }> {
        return Array.from(this.agents.values()).map(agent => ({
            type: agent.getType(),
            id: agent.getId(),
            running: agent.isActive(),
        }));
    }

    /**
     * Get agent health from database
     */
    getAgentHealth(): any[] {
        return db.prepare(`
            SELECT agent_id, agent_type, status, last_heartbeat, updated_at
            FROM agent_registry
            ORDER BY updated_at DESC
        `).all() as any[];
    }
}

// Singleton instance
let agentManagerInstance: AgentManager | null = null;

export function getAgentManager(): AgentManager {
    if (!agentManagerInstance) {
        agentManagerInstance = new AgentManager();
    }
    return agentManagerInstance;
}