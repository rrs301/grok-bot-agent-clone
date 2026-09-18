"use client"
import { ChatPanel } from "@/components/custom/agent-space/ChatPanel"
import { ConfigurationPanel } from "@/components/custom/agent-space/ConfigurationPanel"
import { toast } from "@/components/ui/toast";
import { AgentConfigContext } from "@/context/AgentConfigContext";
import { AgentConfigType } from "@/type/Agent";
import axios from "axios"
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AgentSpace() {

    const { agentId } = useParams();
    const [agentConfig, setAgentConfig] = useState<AgentConfigType | null>()
    useEffect(() => {
        agentId && GetAgentConfig()
    }, [agentId])

    const GetAgentConfig = async () => {
        const result = await axios.get('/api/agent?agentId=' + agentId)
        console.log(result.data);
        setAgentConfig(result.data)
    }





    return (
        <AgentConfigContext.Provider value={{ agentConfig, setAgentConfig }}>
            <main className="grid min-h-svh min-w-0 bg-background lg:h-svh lg:grid-cols-[minmax(0,1fr)_350px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_350px]">

                <ChatPanel />
                <ConfigurationPanel />
            </main>
        </AgentConfigContext.Provider>
    )
}
