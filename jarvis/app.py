"""Application object — wires every real subsystem together."""

from __future__ import annotations

from dataclasses import dataclass

from .agents import AgentOrchestrator
from .audit import AuditLog
from .browser import BrowserAgent
from .coding import LocalCodingAgent
from .computer import ComputerAgent
from .cost import CostManager
from .credentials import CredentialManager
from .cursor_ctrl import CursorAdapter
from .doctor import SystemDoctor
from .downloads import DownloadGuard
from .git_safety import GitSafety
from .kernel import KERNEL
from .mcp import McpRegistry
from .memory import MemorySystem
from .missions import MissionEngine
from .notifications import Notifications
from .orchestrator import Orchestrator
from .permissions import PermissionEngine
from .projects import ProjectBrain
from .providers import ProviderRegistry
from .recovery import RecoveryEngine
from .research import ResearchAgent
from .review import ReviewAgent
from .router import TaskRouter
from .schedule import Scheduler
from .security import SecurityEngine
from .storage import Store
from .tools import ToolRegistry
from .trading import TradingGuard
from .verification import VerificationEngine
from .voice import VoiceSystem


@dataclass
class App:
    store: Store
    missions: MissionEngine
    router: TaskRouter
    permissions: PermissionEngine
    security: SecurityEngine
    orchestrator: Orchestrator
    projects: ProjectBrain
    memory: MemorySystem
    audit: AuditLog
    cost: CostManager
    providers: ProviderRegistry
    tools: ToolRegistry
    doctor: SystemDoctor
    credentials: CredentialManager
    notifications: Notifications
    mcp: McpRegistry
    cursor: CursorAdapter
    voice: VoiceSystem
    git: GitSafety
    downloads: DownloadGuard
    schedule: Scheduler
    trading: TradingGuard
    kernel: object


def create_app(store: Store | None = None) -> App:
    store = store or Store()
    missions = MissionEngine(store)
    router = TaskRouter()
    permissions = PermissionEngine(store)
    security = SecurityEngine()
    cost = CostManager(store)
    providers = ProviderRegistry(cost)
    tools = ToolRegistry()
    audit = AuditLog(store)
    memory = MemorySystem(store)
    projects = ProjectBrain(store)
    notifications = Notifications(store)
    coding = LocalCodingAgent(security)
    cursor = CursorAdapter()
    browser = BrowserAgent(security)
    computer = ComputerAgent(permissions)
    research = ResearchAgent(browser, security)
    review = ReviewAgent()
    verification = VerificationEngine(coding)
    recovery = RecoveryEngine(missions)
    agents = AgentOrchestrator(coding, cursor, research, browser, computer, review)
    orchestrator = Orchestrator(
        missions,
        router,
        permissions,
        security,
        agents,
        verification,
        recovery,
        projects,
        memory,
        audit,
        cost,
        providers,
        tools,
        notifications,
        cursor,
    )
    return App(
        store=store,
        missions=missions,
        router=router,
        permissions=permissions,
        security=security,
        orchestrator=orchestrator,
        projects=projects,
        memory=memory,
        audit=audit,
        cost=cost,
        providers=providers,
        tools=tools,
        doctor=SystemDoctor(),
        credentials=CredentialManager(store),
        notifications=notifications,
        mcp=McpRegistry(store, security),
        cursor=cursor,
        voice=VoiceSystem(),
        git=GitSafety(security),
        downloads=DownloadGuard(security),
        schedule=Scheduler(store),
        trading=TradingGuard(permissions),
        kernel=KERNEL,
    )
