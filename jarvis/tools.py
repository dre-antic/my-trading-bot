"""Tool registry. Every tool declares risk, side effects, and rollback."""

from __future__ import annotations

from .types import RiskLevel, ToolSpec


TOOLS: dict[str, ToolSpec] = {
    spec.name: spec
    for spec in [
        ToolSpec(
            "web_research",
            "Search and read public web pages as untrusted data",
            ["web_research"],
            RiskLevel.GREEN,
            ["query"],
            ["answer", "citations"],
            ["network"],
            "None needed",
        ),
        ToolSpec(
            "create_project_file",
            "Create or update a file inside the workspace",
            ["create_project_file"],
            RiskLevel.GREEN,
            ["path", "content"],
            ["path"],
            ["disk write"],
            "Delete or revert the file",
        ),
        ToolSpec(
            "run_tests",
            "Run automated tests for a project",
            ["run_tests"],
            RiskLevel.GREEN,
            ["cwd"],
            ["exit_code", "output"],
            ["subprocess"],
            "None",
        ),
        ToolSpec(
            "code_inspection",
            "Read project source files",
            ["code_inspection"],
            RiskLevel.GREEN,
            ["path"],
            ["text"],
            ["disk read"],
            "None",
        ),
        ToolSpec(
            "public_browse",
            "Open a public web page",
            ["public_browse"],
            RiskLevel.GREEN,
            ["url"],
            ["content"],
            ["network"],
            "Close the page",
        ),
        ToolSpec(
            "git_push",
            "Push to a remote",
            ["git_push"],
            RiskLevel.RED,
            ["remote"],
            ["result"],
            ["network publish"],
            "Not automatically reversible",
        ),
        ToolSpec(
            "spend_money",
            "Call a paid API or complete a purchase",
            ["spend_money"],
            RiskLevel.RED,
            ["provider", "amount"],
            ["receipt"],
            ["billing"],
            "User must cancel with the vendor",
        ),
        ToolSpec(
            "read_secret_file",
            "Read a protected credential file",
            ["read_secret_file"],
            RiskLevel.RED,
            ["path"],
            ["denied"],
            ["secret exposure"],
            "None — denied by default",
        ),
        ToolSpec(
            "docker_volume_delete",
            "Delete a Docker volume",
            ["docker_volume_delete"],
            RiskLevel.RED,
            ["name"],
            ["status"],
            ["permanent data loss"],
            "Restore from backup if one exists",
        ),
        ToolSpec(
            "execute_download",
            "Run a downloaded executable",
            ["execute_download"],
            RiskLevel.RED,
            ["path"],
            ["status"],
            ["code execution"],
            "Stop the process",
        ),
        ToolSpec(
            "mcp_connect",
            "Connect an MCP server",
            ["mcp_install"],
            RiskLevel.RED,
            ["server"],
            ["status"],
            ["tool privilege"],
            "Disconnect the server",
        ),
        ToolSpec(
            "trading_execute",
            "Place a financial order",
            ["trading_execute"],
            RiskLevel.RED,
            ["order"],
            ["denied or confirmed"],
            ["money movement"],
            "Broker cancellation if still open",
        ),
        ToolSpec(
            "observe_screen",
            "Look at the screen while a visible indicator is on",
            ["observe_screen"],
            RiskLevel.GREEN,
            [],
            ["description"],
            ["screen capture while indicated"],
            "Stop observe mode",
        ),
    ]
}


class ToolRegistry:
    def get(self, name: str) -> ToolSpec | None:
        return TOOLS.get(name)

    def list(self) -> list[ToolSpec]:
        return list(TOOLS.values())

    def require(self, name: str) -> ToolSpec:
        spec = self.get(name)
        if spec is None:
            raise KeyError(f"Unknown tool {name}")
        return spec
