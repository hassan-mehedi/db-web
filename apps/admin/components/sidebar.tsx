"use client";

import {
  Activity,
  Cable,
  ChevronsUpDown,
  Database,
  FolderKanban,
  GitFork,
  HardDriveDownload,
  LogOut,
  Settings,
  Shield,
  Table2,
  Terminal,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { databaseName, envLabel } from "@/lib/projects";

export interface SidebarProject {
  name: string;
  envs: { env: string; database: string }[];
}

export interface AppSidebarProps {
  projects: SidebarProject[];
  backupsUrl?: string | undefined;
}

interface Current {
  project: string;
  env: string | undefined;
  database: string | undefined;
}

const ENV_NAV = [
  { key: "", label: "Overview", icon: Database },
  { key: "/tables", label: "Tables", icon: Table2 },
  { key: "/query", label: "SQL editor", icon: Terminal },
  { key: "/diagram", label: "Diagram", icon: GitFork },
  { key: "/connect", label: "Connect", icon: Cable },
  { key: "/monitoring", label: "Monitoring", icon: Activity },
  { key: "/roles", label: "Roles", icon: Users },
  { key: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar({ projects, backupsUrl }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const params = useParams<{ project?: string; env?: string }>();
  const current: Current | undefined = params.project
    ? {
        project: params.project,
        env: params.env,
        database: params.env ? databaseName(params.project, params.env) : undefined,
      }
    : undefined;
  const base = current?.env ? `/projects/${current.project}/${current.env}` : null;
  const close = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="font-semibold">
              <Link href="/projects" onClick={close}>
                <span className="inline-block size-2.5 rounded-sm bg-primary" />
                db-web
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ProjectSwitcher projects={projects} current={current} onNavigate={close} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono">
            {current?.database ?? "Cluster"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {base ? (
                ENV_NAV.map((item) => {
                  const href = `${base}${item.key}`;
                  const active = item.key === "" ? pathname === base : pathname.startsWith(href);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link href={href} onClick={close}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/projects"}>
                    <Link href="/projects" onClick={close}>
                      <FolderKanban />
                      <span>Projects</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/roles"}>
              <Link href="/roles" onClick={close}>
                <Shield />
                <span>Cluster roles</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {backupsUrl && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href={backupsUrl} target="_blank" rel="noreferrer">
                  <HardDriveDownload />
                  <span>Backups</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => {
                await authClient.signOut();
                router.push("/login");
              }}
            >
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function ProjectSwitcher({
  projects,
  current,
  onNavigate,
}: {
  projects: SidebarProject[];
  current: Current | undefined;
  onNavigate: () => void;
}) {
  const project = projects.find((p) => p.name === current?.project);

  return (
    <div className="grid gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton variant="outline" aria-label="Choose a project">
            <FolderKanban className="text-muted-foreground" />
            <span className="font-medium">{current?.project ?? "Choose a project"}</span>
            <ChevronsUpDown className="ml-auto text-muted-foreground" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-(--radix-dropdown-menu-trigger-width) min-w-48"
        >
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {projects.map((p) => (
            <DropdownMenuItem key={p.name} asChild>
              <Link href={`/projects/${p.name}`} onClick={onNavigate}>
                {p.name}
                <span className="ml-auto text-xs text-muted-foreground">{p.envs.length}</span>
              </Link>
            </DropdownMenuItem>
          ))}
          {projects.length === 0 && <DropdownMenuItem disabled>No projects</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      {project && current && (
        <div className="flex flex-wrap gap-1 px-1">
          {project.envs.map((e) => (
            <Badge
              key={e.database}
              asChild
              variant={e.env === current.env ? "default" : "outline"}
              className="font-mono"
            >
              <Link href={`/projects/${project.name}/${e.env}`} onClick={onNavigate}>
                {envLabel(e.env)}
              </Link>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
