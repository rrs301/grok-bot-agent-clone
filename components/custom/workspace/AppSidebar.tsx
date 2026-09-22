"use client"

import {
  ChevronUpIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  LogOutIcon,
  PlusIcon,
  StoreIcon,
  WrenchIcon,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  SidebarSeparator,
} from "@/components/ui/sidebar"
import Image from "next/image"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import axios from "axios"
import { AgentConfigType } from "@/type/Agent"
import { usePathname } from "next/navigation"
import type { ToolSuggestionCardData } from "@/type/Message"
import { ToolSuggestionCard } from "@/components/custom/agent-space/ToolSuggestionCard"



function AppSidebar() {
  const [agents, setAgents] = useState<AgentConfigType[]>();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const { data } = useSession();
  const path = usePathname();
  const currentAgentId = getAgentIdFromPath(path);

  const userInitials = data?.user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  useEffect(() => {
    GetUserAgents()
  }, [path]);

  const GetUserAgents = async () => {
    const result = await axios.get('/api/agent');
    console.log(result.data);
    setAgents(result.data);
  }

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut({ callbackUrl: "/sign-in" });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-4 px-3 py-4">
        <div className="flex items-center gap-2.5 px-1">
          <Image src="/logo.png" alt="logo" width={45} height={45} />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xl font-semibold leading-none tracking-normal">
              Orbit
            </p>
          </div>
        </div>

        <Link href="/workspace/create">
          <Button size="lg" className="h-10 w-full justify-start gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:px-0">
            <PlusIcon className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">
              Create New Agent
            </span>
          </Button>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2">
          <SidebarGroupLabel>Your Agents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {agents?.map((agent) => (
                <Link href={'/workspace/' + agent.agentId} key={agent.agentId}>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="h-10 gap-2.5 rounded-lg"
                      isActive={agent.agentId === currentAgentId}
                      tooltip={agent.name}
                    >
                      <Avatar size="sm" className="size-6">
                        <AvatarImage src={agent?.agentImage} alt={agent.name} />
                        <AvatarFallback>{agent?.agentImage}</AvatarFallback>
                      </Avatar>
                      <span>{agent.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </Link>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 px-3 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <MarketplaceDialog agentId={currentAgentId} />
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="mx-0" />

        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                aria-label="Open user menu"
              />
            }
          >
            <Avatar className="size-8">
              <AvatarImage
                src={data?.user?.image ?? ''}
                alt={data?.user?.name ?? 'User'}
              />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium leading-none">
                {data?.user?.name}
              </p>
              <p className="mt-1 truncate text-xs text-sidebar-foreground/60">
                {data?.user?.email}
              </p>
            </div>
            <ChevronUpIcon className="size-4 shrink-0 text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden" />
          </PopoverTrigger>

          <PopoverContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-60 gap-2 p-2"
          >
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium">
                {data?.user?.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {data?.user?.email}
              </p>
            </div>
            <div className="h-px bg-border" />
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isSigningOut}
              onClick={handleSignOut}
            >
              {isSigningOut ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <LogOutIcon className="size-4" />
              )}
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Button>
          </PopoverContent>
        </Popover>
      </SidebarFooter>
    </Sidebar>
  )
}

function getAgentIdFromPath(path: string | null) {
  const match = path?.match(/^\/workspace\/([^/]+)/)
  const agentId = match?.[1]

  if (!agentId || agentId === "create" || agentId === "create-agent") return null

  return decodeURIComponent(agentId)
}

function MarketplaceDialog({ agentId }: { agentId: string | null }) {
  const [tools, setTools] = useState<ToolSuggestionCardData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || !agentId) return

    let isMounted = true
    setIsLoading(true)

    axios
      .get<{ tools: ToolSuggestionCardData[] }>("/api/tools/status", {
        params: { agentId },
      })
      .then(({ data }) => {
        if (isMounted) setTools(data.tools)
      })
      .catch(() => {
        if (isMounted) setTools([])
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [agentId, open])

  const updateConnection = (slug: string, isConnected: boolean) => {
    setTools((current) =>
      current.map((tool) =>
        tool.slug.toLowerCase() === slug.toLowerCase()
          ? { ...tool, isConnected }
          : tool
      )
    )
  }

  const connectedTools = tools.filter((tool) => tool.isConnected)
  const availableTools = tools.filter((tool) => !tool.isConnected)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <SidebarMenuButton
            className="h-9 gap-2 rounded-lg"
            tooltip="Marketplace"
          />
        }
      >
        <StoreIcon className="size-4" />
        <span>Marketplace</span>
      </DialogTrigger>

      <DialogContent className="max-h-[86vh] overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <StoreIcon className="size-5" />
            Marketplace
          </DialogTitle>
          <DialogDescription>
            Connect tools this agent can use, or disconnect accounts you no longer want available.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(86vh-112px)] overflow-y-auto px-5 py-5 sm:px-6">
          {!agentId ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
              Open an agent to manage marketplace tools for it.
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center rounded-lg border p-10 text-muted-foreground">
              <LoaderCircleIcon className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              <MarketplaceSection
                title="Connected tools"
                description="Accounts currently connected and ready for this agent."
                emptyIcon={CheckCircle2Icon}
                emptyText="No tools are connected yet."
                agentId={agentId}
                tools={connectedTools}
                onConnectionChange={updateConnection}
              />
              <MarketplaceSection
                title="Available tools"
                description="Connect additional apps and services to expand what this agent can do."
                emptyIcon={WrenchIcon}
                emptyText="No additional tools are available."
                agentId={agentId}
                tools={availableTools}
                onConnectionChange={updateConnection}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MarketplaceSection({
  title,
  description,
  emptyIcon: EmptyIcon,
  emptyText,
  agentId,
  tools,
  onConnectionChange,
}: {
  title: string
  description: string
  emptyIcon: typeof WrenchIcon
  emptyText: string
  agentId: string
  tools: ToolSuggestionCardData[]
  onConnectionChange: (slug: string, isConnected: boolean) => void
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          {tools.length}
        </span>
      </div>

      {tools.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          <EmptyIcon className="size-4" />
          {emptyText}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolSuggestionCard
              key={tool.slug}
              agentId={agentId}
              tool={tool}
              onConnectionChange={onConnectionChange}
              variant="compact"
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default AppSidebar
