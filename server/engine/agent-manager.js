// agent-manager.js — Instantiates all agent instances from config and manages their lifecycle.

import store from '../store/event-store.js';
import { WeatherAgent } from '../agents/weather.js';
import { ATCAgent } from '../agents/atc.js';
import { IndustrialActionAgent } from '../agents/industrial.js';
import { GeopoliticalAgent } from '../agents/geopolitical.js';
import { InfrastructureAgent } from '../agents/infrastructure.js';
import { RegulatoryAgent } from '../agents/regulatory.js';
import { FlightAgent } from '../agents/flight.js';
import { SocialAgent } from '../agents/social.js';

const AGENT_CLASSES = {
  weather: WeatherAgent,
  atc: ATCAgent,
  industrial: IndustrialActionAgent,
  geopolitical: GeopoliticalAgent,
  infrastructure: InfrastructureAgent,
  regulatory: RegulatoryAgent,
  flight: FlightAgent,
  social: SocialAgent,
};

class AgentManager {
  constructor() {
    this.instances = new Map(); // agentId → Agent instance
    this.enabled = true;
  }

  // Instantiate all agents from config and start polling
  startAll() {
    const configs = store.config.agents;
    let started = 0;

    for (const config of configs) {
      // Skip the impact-assessment agent (event-driven, not polling)
      if (config.type === 'impact-assessment') continue;

      const typeConfig = store.agentTypes.find(t => t.type === config.type);
      if (!typeConfig) {
        console.warn(`[AgentManager] No type config for ${config.type}, skipping ${config.id}`);
        continue;
      }

      const AgentClass = AGENT_CLASSES[config.type];
      if (!AgentClass) {
        console.warn(`[AgentManager] No class for type ${config.type}, skipping ${config.id}`);
        continue;
      }

      const agent = new AgentClass(config, typeConfig);
      this.instances.set(config.id, agent);
      agent.start();
      started++;
    }

    console.log(`[AgentManager] Started ${started} polling agents (impact-assessment is event-driven)`);
  }

  // Stop all agents
  stopAll() {
    for (const [id, agent] of this.instances) {
      agent.stop();
    }
    this.instances.clear();
    console.log('[AgentManager] All agents stopped');
  }

  // Trigger a specific agent manually
  async trigger(agentId) {
    const agent = this.instances.get(agentId);
    if (!agent) return null;
    // Check if the agent's region is enabled
    if (!store.isRegionEnabled(agent.region)) {
      return { skipped: true, reason: 'Region disabled', signalsGenerated: 0 };
    }
    return agent.trigger();
  }

  // Pause all agents in a region
  pauseRegion(regionId) {
    let count = 0;
    for (const [id, agent] of this.instances) {
      if (agent.region === regionId) {
        agent.paused = true;
        count++;
      }
    }
    console.log(`[AgentManager] Paused ${count} agents in region ${regionId}`);
    return count;
  }

  // Resume all agents in a region
  resumeRegion(regionId) {
    let count = 0;
    for (const [id, agent] of this.instances) {
      if (agent.region === regionId) {
        agent.paused = false;
        count++;
      }
    }
    console.log(`[AgentManager] Resumed ${count} agents in region ${regionId}`);
    return count;
  }

  // Get agent instance
  get(agentId) {
    return this.instances.get(agentId);
  }

  // Get all agent instances
  getAll() {
    return Array.from(this.instances.values());
  }

  // Get runtime status for all agents
  getStatus() {
    const status = [];
    for (const [id, agent] of this.instances) {
      status.push({
        id,
        type: agent.type,
        region: agent.region,
        subRegion: agent.subRegion,
        isRunning: agent.isRunning,
        status: agent.status,
        pollCount: agent.pollCount,
        lastPollAt: agent.lastPollAt,
        lastError: agent.lastError,
        pollInterval: agent.pollInterval,
        totalSignals: agent.totalSignals,
        lastSignalsGenerated: agent.lastSignalsGenerated,
        lastSignalAt: agent.lastSignalAt,
        lastSignalName: agent.lastSignalName,
        lastDurationMs: agent.lastDurationMs,
      });
    }
    return status;
  }
}

const manager = new AgentManager();
export default manager;
