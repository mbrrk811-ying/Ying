import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { DEFAULT_PROJECTS, ProjectItem, SubActivity, ActivityLog } from './src/types.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'projects.json');
const LOGS_FILE = path.join(DATA_DIR, 'activity_logs.json');

app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to load projects
function loadProjects(): ProjectItem[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      // Ensure data format is array of projects with activities
      if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0].activities)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading projects.json:', err);
  }
  // Initialize default
  saveProjects(DEFAULT_PROJECTS);
  return DEFAULT_PROJECTS;
}

// Helper to save projects
function saveProjects(projects: ProjectItem[]): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving projects.json:', err);
  }
}

// Helper to load logs
function loadLogs(): ActivityLog[] {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading activity_logs.json:', err);
  }
  return [];
}

// Helper to save logs
function addLog(log: ActivityLog): void {
  try {
    const logs = loadLogs();
    logs.unshift(log);
    const trimmed = logs.slice(0, 50); // keep recent 50
    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving activity log:', err);
  }
}

// Real-time SSE Clients list
interface SSEClient {
  id: number;
  res: Response;
}

let clients: SSEClient[] = [];
let nextClientId = 1;

function broadcast(event: { type: string; payload: any }) {
  const dataString = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(dataString);
    } catch {
      // Ignore write errors; will be pruned on close
    }
  }
}

function broadcastClientCount() {
  broadcast({
    type: 'CLIENT_COUNT',
    payload: { count: clients.length }
  });
}

// SSE stream endpoint
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = nextClientId++;
  const client: SSEClient = { id: clientId, res };
  clients.push(client);

  // Send initial welcome & current clients count
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', payload: { clientId, totalClients: clients.length } })}\n\n`);
  broadcastClientCount();

  // Keep connection alive with heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients = clients.filter(c => c.id !== clientId);
    broadcastClientCount();
  });
});

// GET all projects
app.get('/api/projects', (_req: Request, res: Response) => {
  const projects = loadProjects();
  const logs = loadLogs();
  res.json({
    projects,
    logs,
    connectedClients: clients.length,
    lastUpdated: new Date().toISOString()
  });
});

// PUT update project details
app.put('/api/projects/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const updatedData = req.body as Partial<ProjectItem>;
  const projects = loadProjects();
  const index = projects.findIndex(p => p.id === id);

  if (index === -1) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const prev = projects[index];
  const now = new Date().toISOString();
  const updatedProject: ProjectItem = {
    ...prev,
    ...updatedData,
    id,
    lastUpdated: now
  };

  projects[index] = updatedProject;
  saveProjects(projects);

  const log: ActivityLog = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    projectId: id,
    projectTitle: updatedProject.title,
    action: 'อัปเดตรายละเอียดโครงการหลัก',
    timestamp: now,
    user: updatedData.updatedBy || 'ผู้ใช้'
  };
  addLog(log);

  broadcast({
    type: 'PROJECT_UPDATED',
    payload: { project: updatedProject, log }
  });

  res.json({ success: true, project: updatedProject, log });
});

// POST add new project
app.post('/api/projects', (req: Request, res: Response) => {
  const newProject = req.body as ProjectItem;
  const projects = loadProjects();
  
  const id = projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1;
  const fullProject: ProjectItem = {
    ...newProject,
    id,
    activities: newProject.activities || [],
    lastUpdated: new Date().toISOString()
  };

  projects.push(fullProject);
  saveProjects(projects);

  const log: ActivityLog = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    projectId: id,
    projectTitle: fullProject.title,
    action: 'เพิ่มโครงการใหม่',
    timestamp: new Date().toISOString(),
    user: fullProject.updatedBy || 'ผู้ใช้'
  };
  addLog(log);

  broadcast({
    type: 'PROJECT_ADDED',
    payload: { project: fullProject, log }
  });

  res.status(201).json({ success: true, project: fullProject });
});

// DELETE project
app.delete('/api/projects/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  let projects = loadProjects();
  const target = projects.find(p => p.id === id);

  if (!target) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  projects = projects.filter(p => p.id !== id);
  saveProjects(projects);

  const log: ActivityLog = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    projectId: id,
    projectTitle: target.title,
    action: 'ลบโครงการ',
    timestamp: new Date().toISOString(),
    user: 'ผู้ใช้'
  };
  addLog(log);

  broadcast({
    type: 'PROJECT_DELETED',
    payload: { id, log }
  });

  res.json({ success: true, id });
});

// POST add sub-activity to project
app.post('/api/projects/:id/activities', (req: Request, res: Response) => {
  const projectId = Number(req.params.id);
  const newActivityData = req.body as Partial<SubActivity>;
  const projects = loadProjects();
  const project = projects.find(p => p.id === projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  // Calculate new sub-activity id
  const allSubIds = projects.flatMap(p => p.activities.map(a => a.id));
  const newActivityId = allSubIds.length > 0 ? Math.max(...allSubIds) + 1 : 1;

  const newActivity: SubActivity = {
    id: newActivityId,
    projectId,
    title: newActivityData.title || 'กิจกรรมย่อยใหม่',
    budget: Number(newActivityData.budget) || 0,
    owner: newActivityData.owner || project.owner,
    timeline: newActivityData.timeline || 'ตามแผนงาน',
    currentStage: Number(newActivityData.currentStage) || 1,
    alertType: newActivityData.alertType || 'normal',
    alertText: newActivityData.alertText || 'ตามแผนงาน',
    docDate: newActivityData.docDate || '',
    notes: newActivityData.notes || '',
    lastUpdated: new Date().toISOString()
  };

  project.activities.push(newActivity);
  project.lastUpdated = new Date().toISOString();
  saveProjects(projects);

  const log: ActivityLog = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    projectId,
    projectTitle: project.title,
    action: `เพิ่มกิจกรรมย่อย: ${newActivity.title}`,
    timestamp: new Date().toISOString(),
    user: 'ผู้ใช้'
  };
  addLog(log);

  broadcast({
    type: 'PROJECT_UPDATED',
    payload: { project, log }
  });

  res.status(201).json({ success: true, activity: newActivity, project });
});

// PUT update sub-activity
app.put('/api/projects/:id/activities/:activityId', (req: Request, res: Response) => {
  const projectId = Number(req.params.id);
  const activityId = Number(req.params.activityId);
  const updatedData = req.body as Partial<SubActivity>;
  const projects = loadProjects();
  const project = projects.find(p => p.id === projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const actIndex = project.activities.findIndex(a => a.id === activityId);
  if (actIndex === -1) {
    res.status(404).json({ error: 'Sub-activity not found' });
    return;
  }

  const prev = project.activities[actIndex];
  const now = new Date().toISOString();
  const updatedActivity: SubActivity = {
    ...prev,
    ...updatedData,
    id: activityId,
    projectId,
    lastUpdated: now
  };

  project.activities[actIndex] = updatedActivity;
  project.lastUpdated = now;
  saveProjects(projects);

  const stageChanged = updatedData.currentStage !== undefined && updatedData.currentStage !== prev.currentStage;
  const log: ActivityLog = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    projectId,
    projectTitle: project.title,
    action: stageChanged
      ? `${updatedActivity.title} -> ขั้นที่ ${updatedActivity.currentStage}`
      : `อัปเดตกิจกรรม: ${updatedActivity.title}`,
    timestamp: now,
    user: 'ผู้ใช้'
  };
  addLog(log);

  broadcast({
    type: 'PROJECT_UPDATED',
    payload: { project, log }
  });

  res.json({ success: true, activity: updatedActivity, project });
});

// DELETE sub-activity
app.delete('/api/projects/:id/activities/:activityId', (req: Request, res: Response) => {
  const projectId = Number(req.params.id);
  const activityId = Number(req.params.activityId);
  const projects = loadProjects();
  const project = projects.find(p => p.id === projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const target = project.activities.find(a => a.id === activityId);
  if (!target) {
    res.status(404).json({ error: 'Sub-activity not found' });
    return;
  }

  project.activities = project.activities.filter(a => a.id !== activityId);
  project.lastUpdated = new Date().toISOString();
  saveProjects(projects);

  const log: ActivityLog = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    projectId,
    projectTitle: project.title,
    action: `ลบกิจกรรมย่อย: ${target.title}`,
    timestamp: new Date().toISOString(),
    user: 'ผู้ใช้'
  };
  addLog(log);

  broadcast({
    type: 'PROJECT_UPDATED',
    payload: { project, log }
  });

  res.json({ success: true, id: activityId, project });
});

// POST reset to defaults
app.post('/api/projects/reset', (_req: Request, res: Response) => {
  saveProjects(DEFAULT_PROJECTS);
  const log: ActivityLog = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    projectId: 0,
    projectTitle: 'ระบบทั้งหมด',
    action: 'รีเซ็ตข้อมูลโครงการเป็นค่าตั้งต้นปี 2570 (โครงสร้างโครงการและกิจกรรมย่อย)',
    timestamp: new Date().toISOString(),
    user: 'ผู้ดูแลระบบ'
  };
  addLog(log);

  broadcast({
    type: 'PROJECTS_RESET',
    payload: { projects: DEFAULT_PROJECTS, log }
  });

  res.json({ success: true, projects: DEFAULT_PROJECTS });
});

// Setup Vite or Static File Serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Realtime Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
