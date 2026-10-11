import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  BookOpen,
  Users,
  Calendar,
  DollarSign,
  Download,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  FolderOpen,
  Layers,
  Zap,
  Sparkles,
  ShieldCheck,
  Target,
  ListFilter
} from 'lucide-react';
import { ProjectItem, SubActivity, ActivityLog, STAGES, DEFAULT_PROJECTS } from './types.ts';

export default function App() {
  const [projects, setProjects] = useState<ProjectItem[]>(DEFAULT_PROJECTS);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped'); // grouped cards vs flat table

  // Expanded projects in grouped view
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});

  // Real-time state
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [clientCount, setClientCount] = useState<number>(1);
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [recentNotification, setRecentNotification] = useState<string | null>(null);

  // Modals state
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState<boolean>(false);

  const [targetProjectForNewActivity, setTargetProjectForNewActivity] = useState<ProjectItem | null>(null);
  const [isNewActivityModalOpen, setIsNewActivityModalOpen] = useState<boolean>(false);

  const [editingActivity, setEditingActivity] = useState<SubActivity | null>(null);
  const [isEditActivityModalOpen, setIsEditActivityModalOpen] = useState<boolean>(false);

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState<boolean>(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState<boolean>(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState<boolean>(false);

  // New Project Form
  const [newProjectData, setNewProjectData] = useState<Partial<ProjectItem>>({
    code: 'Fon-Res-S',
    title: '',
    description: '',
    owner: '',
    budget: 0,
    timeline: '1 ต.ค. 69 - 30 ก.ย. 70',
    strategicGoal: '',
    notes: ''
  });

  // New Activity Form
  const [newActivityData, setNewActivityData] = useState<Partial<SubActivity>>({
    title: '',
    budget: 0,
    owner: '',
    timeline: '',
    currentStage: 1,
    alertType: 'normal',
    alertText: 'ตามแผนงาน',
    notes: ''
  });

  // Multi-tab sync channel
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH').format(num || 0);
  };

  const showToast = (msg: string) => {
    setRecentNotification(msg);
    setTimeout(() => {
      setRecentNotification((current) => (current === msg ? null : current));
    }, 4000);
  };

  // Sync to local backup
  const syncLocalBackup = (updated: ProjectItem[]) => {
    try {
      localStorage.setItem('research_dashboard_data_70_grouped_v3', JSON.stringify(updated));
      broadcastChannelRef.current?.postMessage({
        type: 'SYNC_PROJECTS',
        projects: updated
      });
    } catch (e) {
      console.warn('Backup sync failed:', e);
    }
  };

  // Initial Data and SSE setup
  useEffect(() => {
    // 1. BroadcastChannel for instant cross-tab sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('research_tracker_realtime_v3');
        bc.onmessage = (event) => {
          if (event.data?.type === 'SYNC_PROJECTS') {
            setProjects(event.data.projects);
            setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
          }
        };
        broadcastChannelRef.current = bc;
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    // 2. Fetch initial data from server
    const fetchInitial = async () => {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.projects) && data.projects.length > 0) {
            setProjects(data.projects);
            if (data.logs) setLogs(data.logs);
            setClientCount(data.connectedClients || 1);
            setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Server fetch fallback to localStorage:', err);
      }

      // Local fallback
      const saved = localStorage.getItem('research_dashboard_data_70_grouped_v3');
      if (saved) {
        try {
          setProjects(JSON.parse(saved));
        } catch {
          setProjects(DEFAULT_PROJECTS);
        }
      } else {
        setProjects(DEFAULT_PROJECTS);
      }
      setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
      setLoading(false);
    };

    fetchInitial();

    // 3. Connect to Server-Sent Events (SSE)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'CONNECTED') {
            setIsConnected(true);
            if (message.payload?.totalClients) {
              setClientCount(message.payload.totalClients);
            }
          } else if (message.type === 'CLIENT_COUNT') {
            setClientCount(message.payload?.count || 1);
          } else if (message.type === 'PROJECT_UPDATED') {
            const updated = message.payload?.project as ProjectItem;
            if (updated) {
              setProjects((prev) =>
                prev.map((p) => (p.id === updated.id ? updated : p))
              );
              setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
              showToast(`Real-time อัปเดต: ${updated.title.slice(0, 30)}...`);
            }
            if (message.payload?.log) {
              setLogs((prev) => [message.payload.log, ...prev.slice(0, 49)]);
            }
          } else if (message.type === 'PROJECT_ADDED') {
            const added = message.payload?.project as ProjectItem;
            if (added) {
              setProjects((prev) => [...prev, added]);
              setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
              showToast(`เพิ่มโครงการใหม่: ${added.title.slice(0, 30)}...`);
            }
            if (message.payload?.log) {
              setLogs((prev) => [message.payload.log, ...prev.slice(0, 49)]);
            }
          } else if (message.type === 'PROJECT_DELETED') {
            const id = message.payload?.id;
            setProjects((prev) => prev.filter((p) => p.id !== id));
            setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
            showToast('ลบโครงการเรียบร้อย');
            if (message.payload?.log) {
              setLogs((prev) => [message.payload.log, ...prev.slice(0, 49)]);
            }
          } else if (message.type === 'PROJECTS_RESET') {
            setProjects(message.payload?.projects || DEFAULT_PROJECTS);
            setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
            showToast('รีเซ็ตข้อมูลโครงการเป็นค่าตั้งต้นเรียบร้อย');
            if (message.payload?.log) {
              setLogs((prev) => [message.payload.log, ...prev.slice(0, 49)]);
            }
          }
        } catch (err) {
          console.error('Error handling SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
      };
    } catch (e) {
      console.warn('SSE connection error:', e);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
    };
  }, []);

  // Toggle Project Expand/Collapse in Grouped View
  const toggleProjectExpand = (projectId: number) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: prev[projectId] === undefined ? false : !prev[projectId]
    }));
  };

  const expandAll = () => {
    const allExpanded: Record<number, boolean> = {};
    projects.forEach((p) => {
      allExpanded[p.id] = true;
    });
    setExpandedProjects(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed: Record<number, boolean> = {};
    projects.forEach((p) => {
      allCollapsed[p.id] = false;
    });
    setExpandedProjects(allCollapsed);
  };

  // Save Project Details Update (แก้ไขรายละเอียดโครงการหลัก)
  const handleSaveProjectDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    const updated: ProjectItem = {
      ...editingProject,
      budget: Number(editingProject.budget) || 0,
      lastUpdated: new Date().toISOString()
    };

    const nextProjects = projects.map((p) => (p.id === updated.id ? updated : p));
    setProjects(nextProjects);
    syncLocalBackup(nextProjects);
    setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
    setIsEditProjectModalOpen(false);

    try {
      const res = await fetch(`/api/projects/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        showToast(`บันทึกโครงการ "${updated.code} - ${updated.title.slice(0, 20)}..." สำเร็จ`);
      }
    } catch {
      showToast('บันทึกลงในเบราว์เซอร์แล้ว (รอเชื่อมต่อเซิร์ฟเวอร์)');
    }
  };

  // Save Sub-Activity Update (แก้ไขกิจกรรมย่อย)
  const handleSaveActivityUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;

    const projectId = editingActivity.projectId;
    const activityId = editingActivity.id;
    const now = new Date().toISOString();

    const updatedActivity: SubActivity = {
      ...editingActivity,
      budget: Number(editingActivity.budget) || 0,
      currentStage: Number(editingActivity.currentStage) || 1,
      lastUpdated: now
    };

    // Update in state
    const nextProjects = projects.map((p) => {
      if (p.id === projectId) {
        const nextActs = p.activities.map((a) => (a.id === activityId ? updatedActivity : a));
        return { ...p, activities: nextActs, lastUpdated: now };
      }
      return p;
    });

    setProjects(nextProjects);
    syncLocalBackup(nextProjects);
    setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
    setIsEditActivityModalOpen(false);

    try {
      await fetch(`/api/projects/${projectId}/activities/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedActivity)
      });
      showToast(`บันทึกกิจกรรมย่อย "${updatedActivity.title.slice(0, 24)}..." สำเร็จ`);
    } catch {
      showToast('บันทึกในเครื่องเรียบร้อย');
    }
  };

  // Quick Stage Change for Sub-activity (+ / - or direct step click)
  const handleQuickActivityStage = async (activity: SubActivity, newStage: number) => {
    if (newStage < 1 || newStage > 8) return;
    const projectId = activity.projectId;
    const now = new Date().toISOString();

    const updatedActivity: SubActivity = {
      ...activity,
      currentStage: newStage,
      lastUpdated: now
    };

    const nextProjects = projects.map((p) => {
      if (p.id === projectId) {
        const nextActs = p.activities.map((a) => (a.id === activity.id ? updatedActivity : a));
        return { ...p, activities: nextActs, lastUpdated: now };
      }
      return p;
    });

    setProjects(nextProjects);
    syncLocalBackup(nextProjects);
    setLastSavedTime(new Date().toLocaleTimeString('th-TH'));

    try {
      await fetch(`/api/projects/${projectId}/activities/${activity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStage: newStage })
      });
      showToast(`ขั้นที่ ${newStage}: ${STAGES[newStage - 1]}`);
    } catch {
      showToast(`เปลี่ยนเป็นขั้นที่ ${newStage}`);
    }
  };

  // Add New Sub-activity to Project (+ เพิ่มกิจกรรมย่อย)
  const handleAddSubActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProjectForNewActivity || !newActivityData.title) return;

    const projectId = targetProjectForNewActivity.id;
    const payload: Partial<SubActivity> = {
      ...newActivityData,
      budget: Number(newActivityData.budget) || 0,
      currentStage: Number(newActivityData.currentStage) || 1,
      owner: newActivityData.owner || targetProjectForNewActivity.owner,
      timeline: newActivityData.timeline || 'ตามแผนงาน',
      alertType: newActivityData.alertType || 'normal',
      alertText: newActivityData.alertText || 'ตามแผนงาน'
    };

    setIsNewActivityModalOpen(false);

    try {
      const res = await fetch(`/api/projects/${projectId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? data.project : p))
        );
        showToast(`เพิ่มกิจกรรมย่อยในโครงการสำเร็จ`);
      }
    } catch {
      // Local optimistic fallback
      const tempId = Date.now();
      const localAct: SubActivity = {
        id: tempId,
        projectId,
        title: payload.title!,
        budget: payload.budget || 0,
        owner: payload.owner || '',
        timeline: payload.timeline || '',
        currentStage: payload.currentStage || 1,
        alertType: payload.alertType || 'normal',
        alertText: payload.alertText || '',
        lastUpdated: new Date().toISOString()
      };
      const nextProjects = projects.map((p) =>
        p.id === projectId ? { ...p, activities: [...p.activities, localAct] } : p
      );
      setProjects(nextProjects);
      syncLocalBackup(nextProjects);
      showToast(`เพิ่มกิจกรรมย่อยสำเร็จ`);
    }

    // Reset Form
    setNewActivityData({
      title: '',
      budget: 0,
      owner: '',
      timeline: '',
      currentStage: 1,
      alertType: 'normal',
      alertText: 'ตามแผนงาน',
      notes: ''
    });
  };

  // Delete Sub-activity
  const handleDeleteSubActivity = async (activity: SubActivity) => {
    if (!confirm(`ต้องการลบกิจกรรมย่อย "${activity.title}" หรือไม่?`)) return;

    const projectId = activity.projectId;
    const nextProjects = projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          activities: p.activities.filter((a) => a.id !== activity.id),
          lastUpdated: new Date().toISOString()
        };
      }
      return p;
    });

    setProjects(nextProjects);
    syncLocalBackup(nextProjects);
    setLastSavedTime(new Date().toLocaleTimeString('th-TH'));

    try {
      await fetch(`/api/projects/${projectId}/activities/${activity.id}`, {
        method: 'DELETE'
      });
      showToast('ลบกิจกรรมย่อยเรียบร้อย');
    } catch {
      showToast('ลบกิจกรรมย่อยเรียบร้อย (ในเครื่อง)');
    }
  };

  // Add New Main Project
  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectData.title) return;

    const payload: ProjectItem = {
      id: Date.now(),
      code: newProjectData.code || 'Fon-Res-S',
      title: newProjectData.title,
      description: newProjectData.description || '',
      owner: newProjectData.owner || 'กลุ่มงานวิจัย',
      budget: Number(newProjectData.budget) || 0,
      timeline: newProjectData.timeline || 'ตามแผนงาน',
      strategicGoal: newProjectData.strategicGoal || '',
      notes: newProjectData.notes || '',
      activities: [],
      lastUpdated: new Date().toISOString()
    };

    const nextProjects = [...projects, payload];
    setProjects(nextProjects);
    syncLocalBackup(nextProjects);
    setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
    setIsNewProjectModalOpen(false);

    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast(`เพิ่มโครงการหลัก "${payload.title}" สำเร็จ`);
    } catch {
      showToast('เพิ่มโครงการหลักสำเร็จ (ในเครื่อง)');
    }

    setNewProjectData({
      code: 'Fon-Res-S',
      title: '',
      description: '',
      owner: '',
      budget: 0,
      timeline: '1 ต.ค. 69 - 30 ก.ย. 70',
      strategicGoal: '',
      notes: ''
    });
  };

  // Reset to default
  const handleResetData = async () => {
    try {
      await fetch('/api/projects/reset', { method: 'POST' });
    } catch {
      // Local fallback
    }
    setProjects(DEFAULT_PROJECTS);
    syncLocalBackup(DEFAULT_PROJECTS);
    setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
    setIsConfirmResetOpen(false);
    showToast('รีเซ็ตข้อมูลโครงการเป็นค่าตั้งต้นเรียบร้อย');
  };

  // Flattened activities list for stats and flat table view
  const allSubActivities = useMemo(() => {
    return projects.flatMap((p) =>
      p.activities.map((a) => ({
        ...a,
        projectCode: p.code,
        projectTitle: p.title,
        projectOwner: p.owner
      }))
    );
  }, [projects]);

  // Overall Stats
  const totalBudget = useMemo(() => {
    return allSubActivities.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);
  }, [allSubActivities]);

  const criticalActivities = useMemo(() => {
    return allSubActivities.filter((a) => a.alertType === 'danger');
  }, [allSubActivities]);

  const warningActivities = useMemo(() => {
    return allSubActivities.filter((a) => a.alertType === 'warning');
  }, [allSubActivities]);

  const pendingApprovalCount = useMemo(() => {
    return allSubActivities.filter((a) => a.currentStage >= 1 && a.currentStage <= 3).length;
  }, [allSubActivities]);

  const activeProcessCount = useMemo(() => {
    return allSubActivities.filter((a) => a.currentStage >= 4 && a.currentStage <= 6).length;
  }, [allSubActivities]);

  // Filter Projects & Activities
  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return projects
      .map((proj) => {
        // Filter sub-activities of this project
        const matchingActivities = proj.activities.filter((act) => {
          const matchesSearch =
            !q ||
            act.title.toLowerCase().includes(q) ||
            act.owner.toLowerCase().includes(q) ||
            act.timeline.toLowerCase().includes(q) ||
            act.alertText.toLowerCase().includes(q) ||
            proj.title.toLowerCase().includes(q) ||
            proj.code.toLowerCase().includes(q);

          const matchesStage =
            selectedStage === 'all' || act.currentStage === parseInt(selectedStage, 10);

          const matchesStatus =
            selectedStatus === 'all' || act.alertType === selectedStatus;

          return matchesSearch && matchesStage && matchesStatus;
        });

        // Also check if project title/code itself matches search when query is present
        const projectMatchesMeta =
          !q ||
          proj.title.toLowerCase().includes(q) ||
          proj.code.toLowerCase().includes(q) ||
          proj.owner.toLowerCase().includes(q) ||
          (proj.strategicGoal && proj.strategicGoal.toLowerCase().includes(q));

        return {
          ...proj,
          matchingActivities,
          shouldShow: matchingActivities.length > 0 || (projectMatchesMeta && selectedStage === 'all' && selectedStatus === 'all')
        };
      })
      .filter((p) => p.shouldShow);
  }, [projects, searchQuery, selectedStage, selectedStatus]);

  // Stage Badge Color
  const getStageBadgeColor = (stage: number) => {
    if (stage <= 2) return 'bg-slate-100 text-slate-700 border-slate-300';
    if (stage === 3) return 'bg-indigo-100 text-indigo-700 border-indigo-300';
    if (stage === 4 || stage === 5) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (stage === 6) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (stage === 7) return 'bg-purple-100 text-purple-800 border-purple-300';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-['Sarabun',sans-serif]">
      {/* Real-time Toast Notification */}
      {recentNotification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900/95 text-white text-xs sm:text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 backdrop-blur-md animate-bounce">
          <Zap className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{recentNotification}</span>
        </div>
      )}

      {/* Top Navigation Header */}
      <header className="bg-indigo-950 text-white sticky top-0 z-40 shadow-lg border-b border-indigo-900/60">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-inner">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight">
                  Research & Academic Project Tracking System
                </h1>
                <span className="hidden sm:inline-block text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  ปีงบประมาณ 2570
                </span>
              </div>
              <p className="text-xs text-indigo-200/90 font-light">
                กลุ่มงานวิจัย นวัตกรรม และบริการวิชาการ วิทยาลัยพยาบาลบรมราชชนนี ตรัง
              </p>
            </div>
          </div>

          {/* Real-time Status Badge & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Indicator */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isConnected
                  ? 'bg-emerald-950/70 border-emerald-600/60 text-emerald-200'
                  : 'bg-amber-950/60 border-amber-600/50 text-amber-200'
              }`}
              title="ระบบ Real-time ซิงค์สดอัตโนมัติ"
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                ></span>
              </span>
              <span className="hidden md:inline">
                {isConnected ? 'Real-time ออนไลน์' : 'ซิงค์ในเครื่อง'}
              </span>
              <span className="text-[11px] bg-white/10 px-1.5 py-0.2 rounded font-mono">
                {clientCount} เครื่อง
              </span>
              {lastSavedTime && (
                <span className="text-[10px] text-slate-300 hidden lg:inline">
                  • {lastSavedTime}
                </span>
              )}
            </div>

            {/* Notification Bell Badge */}
            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="relative p-2 bg-indigo-900 hover:bg-indigo-800 rounded-lg border border-indigo-800 transition"
              title="ดูรายการแจ้งเตือนด่วน"
            >
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              {criticalActivities.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                  {criticalActivities.length}
                </span>
              )}
            </button>

            {/* Add Main Project */}
            <button
              onClick={() => setIsNewProjectModalOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1.5 rounded-lg transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มโครงการหลัก</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Summary Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>โครงการหลัก / กิจกรรม</span>
              <FolderOpen className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-2">
              {projects.length}{' '}
              <span className="text-xs font-normal text-slate-500">โครงการ</span>
            </p>
            <p className="text-[11px] text-indigo-600 font-medium mt-1">
              รวม {allSubActivities.length} กิจกรรมย่อย
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs border-l-4 border-l-emerald-500 hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>งบประมาณรวมทั้งสิ้น</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-emerald-600 mt-2">
              {formatNumber(totalBudget)}{' '}
              <span className="text-xs font-normal text-slate-500">บาท</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">งบกิจกรรมทั้งหมดตามแผน</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs border-l-4 border-l-amber-500 hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>รอส่งแผน/การเงิน/อนุมัติ</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-2">{pendingApprovalCount}</p>
            <p className="text-[11px] text-slate-400 mt-1">กิจกรรมในขั้นตอนที่ 1 - 3</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs border-l-4 border-l-blue-500 hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>รอยืมเงิน/จัดกิจกรรม</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-2">{activeProcessCount}</p>
            <p className="text-[11px] text-slate-400 mt-1">กิจกรรมในขั้นตอนที่ 4 - 6</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs border-l-4 border-l-rose-500 hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>เตือนวิกฤต / เร่งด่วน</span>
              <AlertOctagon className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-rose-600 mt-2">
              {criticalActivities.length}
            </p>
            <p className="text-[11px] text-rose-500 font-medium mt-1">
              {warningActivities.length} กิจกรรมใกล้ถึงกำหนด
            </p>
          </div>
        </section>

        {/* Real-time Notice Bar */}
        <section className="bg-gradient-to-r from-indigo-50 via-emerald-50/60 to-slate-50 border border-indigo-100 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-indigo-950 font-medium">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>โครงสร้างรวมกิจกรรมย่อย:</strong> กิจกรรมย่อยถูกจัดรวมอยู่ภายใต้โครงการหลักตามรหัสแผน สามารถคลิกเพื่อแก้ไขรายละเอียดโครงการ หรือเพิ่ม/ปรับกิจกรรมย่อยได้ทันทีแบบ Real-time
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLogsModalOpen(true)}
              className="text-indigo-700 hover:text-indigo-900 font-semibold underline underline-offset-2 flex items-center gap-1"
            >
              ประวัติ ({logs.length})
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => setIsConfirmResetOpen(true)}
              className="text-rose-600 hover:text-rose-800 font-medium"
            >
              รีเซ็ตค่าตั้งต้น
            </button>
          </div>
        </section>

        {/* Filters and View Switcher Toolbar */}
        <section className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาโครงการหลัก, กิจกรรม, ผู้รับผิดชอบ..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Stage Selector */}
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">ทุกขั้นตอน (1 - 8)</option>
              {STAGES.map((st, idx) => (
                <option key={idx} value={String(idx + 1)}>
                  {idx + 1}. {st}
                </option>
              ))}
            </select>

            {/* Alert Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">สถานะแจ้งเตือนทั้งหมด</option>
              <option value="normal">✓ ปกติ (ตามแผน)</option>
              <option value="warning">⚠️ เตือน: ใกล้ถึงกำหนด</option>
              <option value="danger">🚨 วิกฤต: ต้องเร่งดำเนินการ</option>
            </select>
          </div>

          {/* View Mode Toggle & Expand Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'grouped' && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mr-2">
                <button
                  onClick={expandAll}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-medium"
                >
                  ขยายทั้งหมด
                </button>
                <button
                  onClick={collapseAll}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-medium"
                >
                  ยุบทั้งหมด
                </button>
              </div>
            )}

            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
                  viewMode === 'grouped'
                    ? 'bg-white text-indigo-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>จัดกลุ่มตามโครงการหลัก</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>ตารางกิจกรรมทั้งหมด</span>
              </button>
            </div>
          </div>
        </section>

        {/* VIEW MODE 1: Grouped Project Cards with Embedded Sub-activities */}
        {viewMode === 'grouped' ? (
          <div className="space-y-4">
            {filteredProjects.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">ไม่พบโครงการตามเงื่อนไขที่ค้นหา</p>
              </div>
            ) : (
              filteredProjects.map((project) => {
                const isExpanded = expandedProjects[project.id] !== false; // default expanded
                const activities = (project as any).matchingActivities || project.activities;
                const projectSubTotalBudget = project.activities.reduce(
                  (sum, a) => sum + (Number(a.budget) || 0),
                  0
                );
                const hasDanger = project.activities.some((a) => a.alertType === 'danger');
                const hasWarning = project.activities.some((a) => a.alertType === 'warning');

                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition"
                  >
                    {/* Project Header Bar */}
                    <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-[280px]">
                        <button
                          onClick={() => toggleProjectExpand(project.id)}
                          className="mt-1 p-1 rounded-lg hover:bg-slate-200/80 text-slate-500 transition"
                          title={isExpanded ? 'ยุบรายการกิจกรรม' : 'ขยายรายการกิจกรรม'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-500" />
                          )}
                        </button>

                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                              {project.code}
                            </span>
                            <span className="text-xs bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                              {project.activities.length} กิจกรรมย่อย
                            </span>
                            {hasDanger && (
                              <span className="text-[11px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-semibold border border-rose-200 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                                มีกิจกรรมเร่งด่วน
                              </span>
                            )}
                            {hasWarning && !hasDanger && (
                              <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                                มีกิจกรรมใกล้ถึงกำหนด
                              </span>
                            )}
                          </div>

                          <h2
                            onClick={() => toggleProjectExpand(project.id)}
                            className="text-base font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition"
                          >
                            {project.title}
                          </h2>

                          {project.description && (
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {project.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
                            <span>
                              <strong className="text-slate-600">ผู้รับผิดชอบหลัก:</strong>{' '}
                              {project.owner || '-'}
                            </span>
                            <span>
                              <strong className="text-slate-600">งบประมาณรวม:</strong>{' '}
                              <span className="text-emerald-700 font-semibold font-mono">
                                {formatNumber(projectSubTotalBudget || project.budget)} บาท
                              </span>
                            </span>
                            <span>
                              <strong className="text-slate-600">กรอบเวลา:</strong>{' '}
                              {project.timeline || 'ตามแผนงาน'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Project Header Action Buttons */}
                      <div className="flex items-center gap-2">
                        {/* Edit Project Details Button */}
                        <button
                          onClick={() => {
                            setEditingProject({ ...project });
                            setIsEditProjectModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs bg-white hover:bg-slate-100 text-indigo-700 font-medium rounded-lg border border-indigo-200 transition flex items-center gap-1.5 shadow-2xs"
                          title="แก้ไขรายละเอียดโครงการหลัก"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>แก้ไขรายละเอียดโครงการ</span>
                        </button>

                        {/* Add Sub-Activity Button */}
                        <button
                          onClick={() => {
                            setTargetProjectForNewActivity(project);
                            setNewActivityData({
                              title: '',
                              budget: 0,
                              owner: project.owner,
                              timeline: project.timeline,
                              currentStage: 1,
                              alertType: 'normal',
                              alertText: 'ตามแผนงาน',
                              notes: ''
                            });
                            setIsNewActivityModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg border border-emerald-300 transition flex items-center gap-1"
                          title="เพิ่มกิจกรรมย่อยในโครงการนี้"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>เพิ่มกิจกรรมย่อย</span>
                        </button>
                      </div>
                    </div>

                    {/* Sub-activities Table / List */}
                    {isExpanded && (
                      <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm text-slate-600">
                          <thead className="bg-slate-100/60 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200/60">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">#</th>
                              <th className="py-2.5 px-4 min-w-[260px]">ชื่อกิจกรรมย่อย</th>
                              <th className="py-2.5 px-3 min-w-[140px]">ผู้รับผิดชอบกิจกรรม</th>
                              <th className="py-2.5 px-3 text-right min-w-[90px]">งบประมาณ</th>
                              <th className="py-2.5 px-3 min-w-[130px]">กำหนดวันจัด</th>
                              <th className="py-2.5 px-4 min-w-[230px]">ขั้นตอนกำกับติดตาม (Real-time)</th>
                              <th className="py-2.5 px-3 min-w-[150px]">การแจ้งเตือนเอกสาร</th>
                              <th className="py-2.5 px-3 text-center w-24">จัดการ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activities.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="py-4 text-center text-xs text-slate-400">
                                  ยังไม่มีกิจกรรมย่อยในโครงการนี้ กด "เพิ่มกิจกรรมย่อย" เพื่อเริ่มบันทึก
                                </td>
                              </tr>
                            ) : (
                              activities.map((act: SubActivity, aIdx: number) => (
                                <tr
                                  key={act.id}
                                  className={`hover:bg-slate-50 transition-colors ${
                                    act.alertType === 'danger'
                                      ? 'bg-rose-50/40'
                                      : act.alertType === 'warning'
                                      ? 'bg-amber-50/30'
                                      : ''
                                  }`}
                                >
                                  <td className="py-2.5 px-3 text-center font-mono text-xs text-slate-400">
                                    {aIdx + 1}
                                  </td>

                                  <td className="py-2.5 px-4">
                                    <div className="font-medium text-slate-900 leading-snug">
                                      {act.title}
                                    </div>
                                    {act.notes && (
                                      <div className="text-[11px] text-slate-400 mt-0.5">
                                        📝 {act.notes}
                                      </div>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-pre-line">
                                    {act.owner || '-'}
                                  </td>

                                  <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                                    {act.budget > 0 ? `${formatNumber(act.budget)} ฿` : '-'}
                                  </td>

                                  <td className="py-2.5 px-3 text-xs">
                                    <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      <span>{act.timeline || '-'}</span>
                                    </span>
                                  </td>

                                  {/* Interactive Stage Step Indicator */}
                                  <td className="py-2.5 px-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span
                                          className={`text-[11px] font-semibold px-2 py-0.2 rounded-full border ${getStageBadgeColor(
                                            act.currentStage
                                          )}`}
                                        >
                                          ขั้นที่ {act.currentStage}: {STAGES[act.currentStage - 1]}
                                        </span>
                                        <div className="flex items-center gap-1 text-[10px]">
                                          <button
                                            onClick={() =>
                                              handleQuickActivityStage(act, act.currentStage - 1)
                                            }
                                            disabled={act.currentStage <= 1}
                                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 flex items-center justify-center font-bold"
                                            title="ลดขั้นตอน"
                                          >
                                            -
                                          </button>
                                          <button
                                            onClick={() =>
                                              handleQuickActivityStage(act, act.currentStage + 1)
                                            }
                                            disabled={act.currentStage >= 8}
                                            className="w-5 h-5 rounded bg-indigo-100 hover:bg-indigo-200 disabled:opacity-30 text-indigo-700 flex items-center justify-center font-bold"
                                            title="เลื่อนขั้นถัดไป (Real-time)"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>

                                      {/* 8-Segment Stepper Clickable */}
                                      <div className="flex gap-1 h-2">
                                        {STAGES.map((_, sIdx) => {
                                          const stepNumber = sIdx + 1;
                                          const isCompleted = stepNumber <= act.currentStage;
                                          const isCurrent = stepNumber === act.currentStage;
                                          return (
                                            <button
                                              key={sIdx}
                                              onClick={() =>
                                                handleQuickActivityStage(act, stepNumber)
                                              }
                                              title={`เปลี่ยนเป็นขั้นที่ ${stepNumber}: ${STAGES[sIdx]}`}
                                              className={`flex-1 rounded-xs transition-all ${
                                                isCurrent
                                                  ? 'bg-indigo-600 ring-2 ring-indigo-300'
                                                  : isCompleted
                                                  ? 'bg-indigo-400 hover:bg-indigo-500'
                                                  : 'bg-slate-200 hover:bg-slate-300'
                                              }`}
                                            />
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Alert Highlight */}
                                  <td className="py-2.5 px-3">
                                    {act.alertType === 'danger' && (
                                      <span className="inline-flex items-start gap-1 text-xs font-semibold text-rose-700 bg-rose-100/90 border border-rose-200 px-2 py-0.5 rounded-lg">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping mt-1 shrink-0"></span>
                                        <span>{act.alertText}</span>
                                      </span>
                                    )}
                                    {act.alertType === 'warning' && (
                                      <span className="inline-flex items-start gap-1 text-xs font-semibold text-amber-700 bg-amber-100/90 border border-amber-200 px-2 py-0.5 rounded-lg">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0"></span>
                                        <span>{act.alertText}</span>
                                      </span>
                                    )}
                                    {act.alertType === 'normal' && (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-md">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>ปกติ</span>
                                      </span>
                                    )}
                                  </td>

                                  {/* Action Buttons */}
                                  <td className="py-2.5 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => {
                                          setEditingActivity({ ...act });
                                          setIsEditActivityModalOpen(true);
                                        }}
                                        className="p-1 text-indigo-700 hover:bg-indigo-50 rounded transition"
                                        title="แก้ไขกิจกรรมย่อย"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSubActivity(act)}
                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                                        title="ลบกิจกรรมย่อย"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* VIEW MODE 2: Flat Table of All Activities */
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-600">
                <thead className="bg-slate-100/80 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-4 min-w-[280px]">โครงการหลัก / กิจกรรมย่อย</th>
                    <th className="py-3 px-3 min-w-[140px]">ผู้รับผิดชอบ</th>
                    <th className="py-3 px-3 text-right min-w-[90px]">งบประมาณ</th>
                    <th className="py-3 px-3 min-w-[130px]">กำหนดวันจัด</th>
                    <th className="py-3 px-4 min-w-[220px]">ขั้นตอนกำกับติดตาม</th>
                    <th className="py-3 px-3 min-w-[140px]">สถานะแจ้งเตือน</th>
                    <th className="py-3 px-3 text-center w-20">แก้ไข</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allSubActivities.map((act, index) => (
                    <tr
                      key={act.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        act.alertType === 'danger'
                          ? 'bg-rose-50/40'
                          : act.alertType === 'warning'
                          ? 'bg-amber-50/30'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-mono text-xs text-slate-400">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-100 font-bold">
                          {act.projectCode}
                        </span>
                        <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {act.projectTitle}
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5 leading-snug">
                          {act.title}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-xs text-slate-600 whitespace-pre-line">
                        {act.owner || '-'}
                      </td>

                      <td className="py-3 px-3 text-right font-medium text-slate-800">
                        {act.budget > 0 ? `${formatNumber(act.budget)} ฿` : '-'}
                      </td>

                      <td className="py-3 px-3 text-xs">
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{act.timeline}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getStageBadgeColor(
                            act.currentStage
                          )}`}
                        >
                          ขั้นที่ {act.currentStage}: {STAGES[act.currentStage - 1]}
                        </span>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${(act.currentStage / 8) * 100}%` }}
                          ></div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {act.alertType === 'danger' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                            🚨 {act.alertText}
                          </span>
                        )}
                        {act.alertType === 'warning' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                            ⚠️ {act.alertText}
                          </span>
                        )}
                        {act.alertType === 'normal' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                            ✓ ปกติ
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            setEditingActivity({ ...act });
                            setIsEditActivityModalOpen(true);
                          }}
                          className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200 transition"
                        >
                          แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8-Stage Lifecycle Standards Reference Card */}
        <section className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            มาตรฐานรอบการกำกับเอกสาร 8 ขั้นตอน (ปีงบประมาณ 2570)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-indigo-700 block text-xs">1. ส่งงานแผน</span>
              <span className="text-[11px] text-slate-500">ตรวจยุทธศาสตร์</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-indigo-700 block text-xs">2. ส่งการเงิน</span>
              <span className="text-[11px] text-slate-500">ตรวจกรอบงบ</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-bold text-indigo-700 block text-xs">3. เสนอ ผอ.</span>
              <span className="text-[11px] text-slate-500">ลงนามอนุมัติ</span>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="font-bold text-amber-700 block text-xs">4. จัดซื้อจัดจ้าง</span>
              <span className="text-[11px] text-amber-700">ล่วงหน้า ≥ 15 วัน</span>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="font-bold text-amber-700 block text-xs">5. บันทึก/ยืมเงิน</span>
              <span className="text-[11px] text-amber-700">ล่วงหน้า ≥ 7 วัน</span>
            </div>
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="font-bold text-blue-700 block text-xs">6. จัดโครงการ</span>
              <span className="text-[11px] text-blue-700">จัดกิจกรรมตามแผน</span>
            </div>
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
              <span className="font-bold text-rose-700 block text-xs">7. สรุปโครงการ</span>
              <span className="text-[11px] text-rose-700">ภายใน 15 วันหลังจัด</span>
            </div>
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
              <span className="font-bold text-rose-700 block text-xs">8. ส่งเบิกเงิน</span>
              <span className="text-[11px] text-rose-700">ส่งใบเสร็จ/ล้างเงินยืม</span>
            </div>
          </div>
        </section>
      </main>

      {/* MODAL 1: Edit Project Details (แก้ไขรายละเอียดโครงการหลัก) */}
      {isEditProjectModalOpen && editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-800">
                  แก้ไขรายละเอียดโครงการหลัก
                </h3>
              </div>
              <button
                onClick={() => setIsEditProjectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProjectDetails} className="space-y-3.5 text-xs sm:text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสโครงการแผนงาน
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProject.code}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, code: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ผู้รับผิดชอบหลัก / หัวหน้าโครงการ
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProject.owner}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, owner: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อโครงการหลัก *
                </label>
                <textarea
                  rows={2}
                  required
                  value={editingProject.title}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, title: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  วัตถุประสงค์ / คำอธิบายโครงการ
                </label>
                <textarea
                  rows={2}
                  value={editingProject.description || ''}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, description: e.target.value })
                  }
                  placeholder="ระบุวัตถุประสงค์หรือรายละเอียดโครงการ..."
                  className="w-full p-2 border rounded-lg text-xs"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    งบประมาณโครงการ (บาท)
                  </label>
                  <input
                    type="number"
                    value={editingProject.budget}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        budget: Number(e.target.value)
                      })
                    }
                    className="w-full p-2 border rounded-lg text-xs font-semibold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ช่วงเวลาดำเนินงาน (timeline)
                  </label>
                  <input
                    type="text"
                    value={editingProject.timeline}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        timeline: e.target.value
                      })
                    }
                    placeholder="เช่น 1 ต.ค. 69 - 30 ก.ย. 70"
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ยุทธศาสตร์ / เป้าหมาย
                </label>
                <input
                  type="text"
                  value={editingProject.strategicGoal || ''}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      strategicGoal: e.target.value
                    })
                  }
                  placeholder="เช่น ยุทธศาสตร์บริการสุขภาพสู่ชุมชน..."
                  className="w-full p-2 border rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุ / เลขที่หนังสือ
                </label>
                <input
                  type="text"
                  value={editingProject.notes || ''}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, notes: e.target.value })
                  }
                  placeholder="เช่น หนังสืออนุมัติเลขที่..."
                  className="w-full p-2 border rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  บันทึกและซิงค์ Real-time ทันที
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditProjectModalOpen(false)}
                    className="px-4 py-2 text-xs border rounded-lg hover:bg-slate-100"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    บันทึกรายละเอียดโครงการ
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Sub-Activity (+ เพิ่มกิจกรรมย่อย) */}
      {isNewActivityModalOpen && targetProjectForNewActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                  {targetProjectForNewActivity.code}
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 mt-1">
                  เพิ่มกิจกรรมย่อยในโครงการ: {targetProjectForNewActivity.title}
                </h3>
              </div>
              <button
                onClick={() => setIsNewActivityModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubActivity} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อกิจกรรมย่อย *
                </label>
                <input
                  type="text"
                  required
                  value={newActivityData.title}
                  onChange={(e) =>
                    setNewActivityData({ ...newActivityData, title: e.target.value })
                  }
                  placeholder="เช่น กิจกรรมที่ 1 การจัดอบรมเชิงปฏิบัติการ..."
                  className="w-full p-2 border rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ผู้รับผิดชอบกิจกรรม
                  </label>
                  <input
                    type="text"
                    value={newActivityData.owner}
                    onChange={(e) =>
                      setNewActivityData({ ...newActivityData, owner: e.target.value })
                    }
                    placeholder="เช่น ผศ.ดร. ..."
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    งบประมาณกิจกรรม (บาท)
                  </label>
                  <input
                    type="number"
                    value={newActivityData.budget}
                    onChange={(e) =>
                      setNewActivityData({
                        ...newActivityData,
                        budget: Number(e.target.value)
                      })
                    }
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    กำหนดวันจัดกิจกรรม
                  </label>
                  <input
                    type="text"
                    value={newActivityData.timeline}
                    onChange={(e) =>
                      setNewActivityData({
                        ...newActivityData,
                        timeline: e.target.value
                      })
                    }
                    placeholder="เช่น 20-22 พ.ย. 69"
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ขั้นตอนกำกับติดตามเริ่มต้น
                  </label>
                  <select
                    value={newActivityData.currentStage}
                    onChange={(e) =>
                      setNewActivityData({
                        ...newActivityData,
                        currentStage: Number(e.target.value)
                      })
                    }
                    className="w-full p-2 border rounded-lg text-xs bg-white"
                  >
                    {STAGES.map((st, idx) => (
                      <option key={idx} value={idx + 1}>
                        ขั้นที่ {idx + 1}: {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สถานะการแจ้งเตือน
                  </label>
                  <select
                    value={newActivityData.alertType}
                    onChange={(e) =>
                      setNewActivityData({
                        ...newActivityData,
                        alertType: e.target.value as any
                      })
                    }
                    className="w-full p-2 border rounded-lg text-xs bg-white"
                  >
                    <option value="normal">✓ ปกติ (ตามแผน)</option>
                    <option value="warning">⚠️ เตือน: ใกล้ถึงกำหนด</option>
                    <option value="danger">🚨 วิกฤต: ต้องเร่งดำเนินการ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ข้อความแจ้งเตือน / โน้ต
                  </label>
                  <input
                    type="text"
                    value={newActivityData.alertText}
                    onChange={(e) =>
                      setNewActivityData({
                        ...newActivityData,
                        alertText: e.target.value
                      })
                    }
                    placeholder="เช่น เร่งยืมเงินล่วงหน้า 7 วัน"
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewActivityModalOpen(false)}
                  className="px-4 py-2 text-xs border rounded-lg hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                >
                  เพิ่มกิจกรรมย่อย
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Sub-Activity (แก้ไขกิจกรรมย่อย) */}
      {isEditActivityModalOpen && editingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base">
                แก้ไขกิจกรรมย่อย
              </h3>
              <button
                onClick={() => setIsEditActivityModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveActivityUpdate} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อกิจกรรมย่อย *
                </label>
                <input
                  type="text"
                  required
                  value={editingActivity.title}
                  onChange={(e) =>
                    setEditingActivity({ ...editingActivity, title: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ผู้รับผิดชอบกิจกรรม
                  </label>
                  <input
                    type="text"
                    value={editingActivity.owner}
                    onChange={(e) =>
                      setEditingActivity({ ...editingActivity, owner: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    งบประมาณ (บาท)
                  </label>
                  <input
                    type="number"
                    value={editingActivity.budget}
                    onChange={(e) =>
                      setEditingActivity({
                        ...editingActivity,
                        budget: Number(e.target.value)
                      })
                    }
                    className="w-full p-2 border rounded-lg text-xs font-semibold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    กำหนดวันจัดกิจกรรม
                  </label>
                  <input
                    type="text"
                    value={editingActivity.timeline}
                    onChange={(e) =>
                      setEditingActivity({
                        ...editingActivity,
                        timeline: e.target.value
                      })
                    }
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ขั้นตอนดำเนินงาน (1 - 8)
                  </label>
                  <select
                    value={editingActivity.currentStage}
                    onChange={(e) =>
                      setEditingActivity({
                        ...editingActivity,
                        currentStage: Number(e.target.value)
                      })
                    }
                    className="w-full p-2 border rounded-lg text-xs bg-white font-medium text-indigo-900"
                  >
                    {STAGES.map((st, idx) => (
                      <option key={idx} value={idx + 1}>
                        ขั้นที่ {idx + 1}: {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สถานะการแจ้งเตือน
                  </label>
                  <select
                    value={editingActivity.alertType}
                    onChange={(e) =>
                      setEditingActivity({
                        ...editingActivity,
                        alertType: e.target.value as any
                      })
                    }
                    className="w-full p-2 border rounded-lg text-xs bg-white"
                  >
                    <option value="normal">✓ ปกติ (ตามแผน)</option>
                    <option value="warning">⚠️ เตือน: ใกล้ถึงกำหนด</option>
                    <option value="danger">🚨 วิกฤต: ต้องเร่งดำเนินการ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    วันที่ส่งเอกสารล่าสุด
                  </label>
                  <input
                    type="date"
                    value={editingActivity.docDate || ''}
                    onChange={(e) =>
                      setEditingActivity({
                        ...editingActivity,
                        docDate: e.target.value
                      })
                    }
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ข้อความแจ้งเตือน / โน้ตกำกับเอกสาร
                </label>
                <input
                  type="text"
                  value={editingActivity.alertText}
                  onChange={(e) =>
                    setEditingActivity({
                      ...editingActivity,
                      alertText: e.target.value
                    })
                  }
                  className="w-full p-2 border rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  บันทึกเพิ่มเติม
                </label>
                <textarea
                  rows={2}
                  value={editingActivity.notes || ''}
                  onChange={(e) =>
                    setEditingActivity({ ...editingActivity, notes: e.target.value })
                  }
                  placeholder="ระบุข้อความหรือเลขที่เอกสารเพิ่มเติม..."
                  className="w-full p-2 border rounded-lg text-xs"
                ></textarea>
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  ซิงค์ Real-time ไปยังทุกเครื่องทันที
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditActivityModalOpen(false)}
                    className="px-4 py-2 text-xs border rounded-lg hover:bg-slate-100"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    บันทึกกิจกรรมย่อย
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Create New Main Project */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                เพิ่มโครงการหลักใหม่
              </h3>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewProject} className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสโครงการ
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjectData.code}
                    onChange={(e) =>
                      setNewProjectData({ ...newProjectData, code: e.target.value })
                    }
                    placeholder="Fon-Res-S..."
                    className="w-full p-2 border rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    งบประมาณรวม (บาท)
                  </label>
                  <input
                    type="number"
                    value={newProjectData.budget}
                    onChange={(e) =>
                      setNewProjectData({
                        ...newProjectData,
                        budget: Number(e.target.value)
                      })
                    }
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อโครงการหลัก *
                </label>
                <input
                  type="text"
                  required
                  value={newProjectData.title}
                  onChange={(e) =>
                    setNewProjectData({ ...newProjectData, title: e.target.value })
                  }
                  placeholder="ระบุชื่อโครงการหลัก..."
                  className="w-full p-2 border rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ผู้รับผิดชอบหลัก
                  </label>
                  <input
                    type="text"
                    value={newProjectData.owner}
                    onChange={(e) =>
                      setNewProjectData({ ...newProjectData, owner: e.target.value })
                    }
                    placeholder="ชื่อผู้รับผิดชอบ..."
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ช่วงเวลาดำเนินงาน
                  </label>
                  <input
                    type="text"
                    value={newProjectData.timeline}
                    onChange={(e) =>
                      setNewProjectData({
                        ...newProjectData,
                        timeline: e.target.value
                      })
                    }
                    placeholder="1 ต.ค. 69 - 30 ก.ย. 70"
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  วัตถุประสงค์ / คำอธิบายโครงการ
                </label>
                <textarea
                  rows={2}
                  value={newProjectData.description || ''}
                  onChange={(e) =>
                    setNewProjectData({
                      ...newProjectData,
                      description: e.target.value
                    })
                  }
                  placeholder="รายละเอียดโครงการ..."
                  className="w-full p-2 border rounded-lg text-xs"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 text-xs border rounded-lg hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                >
                  เพิ่มโครงการหลัก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Urgent / Alert Activities List */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-rose-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                รายการเอกสารที่ต้องเร่งดำเนินการ ({criticalActivities.length + warningActivities.length} รายการ)
              </h3>
              <button
                onClick={() => setIsAlertModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {[...criticalActivities, ...warningActivities].map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-lg border text-xs ${
                    a.alertType === 'danger'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-mono text-[10px] bg-white/70 px-1.5 py-0.2 rounded border font-bold mr-1">
                        {a.projectCode}
                      </span>
                      <strong className="text-slate-900">{a.title}</strong>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] bg-white/80 px-1.5 py-0.5 rounded border">
                      ขั้นที่ {a.currentStage}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between items-center text-[11px] text-slate-600">
                    <span>ผู้รับผิดชอบ: <strong>{a.owner || '-'}</strong></span>
                    <span className="font-semibold text-rose-700">{a.alertText}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-right pt-2 border-t">
              <button
                onClick={() => setIsAlertModalOpen(false)}
                className="px-4 py-1.5 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Activity History Logs */}
      {isLogsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                ประวัติการบันทึกข้อมูล Real-time ล่าสุด
              </h3>
              <button
                onClick={() => setIsLogsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">ยังไม่มีบันทึกกิจกรรม</p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{log.projectTitle}</p>
                      <p className="text-[11px] text-indigo-600">{log.action}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('th-TH')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="text-right pt-2 border-t">
              <button
                onClick={() => setIsLogsModalOpen(false)}
                className="px-4 py-1.5 text-xs bg-slate-800 text-white rounded-lg"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Reset Confirmation */}
      {isConfirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              ยืนยันการคืนค่าตั้งต้น?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              ข้อมูลโครงการและกิจกรรมย่อยทั้งหมดจะถูกคืนค่ากลับเป็นชุดข้อมูลมาตรฐานปี 2570 และซิงค์ไปยังทุกเครื่องทันที
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsConfirmResetOpen(false)}
                className="px-4 py-2 text-xs border rounded-lg hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleResetData}
                className="px-4 py-2 text-xs bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium"
              >
                ยืนยันการรีเซ็ต
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
