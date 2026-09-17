"use client"

import Link from "next/link"
import { Loader2, ShuffleIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import axios from 'axios'


function CreateAgent() {

  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [avatarSeed, setAvatarSeed] = useState<string>(crypto.randomUUID());
  const [isLoading, setIsLoading] = useState(false);

  function shuffleAvatar() {
    const seed = crypto.randomUUID();
    setAvatarSeed(seed);
  }


  const onClickCreateAgent = async (e: any) => {
    e.preventDefault();
    setIsLoading(true);
    const avatarImage = `https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=${avatarSeed}`;
    const newAgentId = crypto.randomUUID();
    const result = await axios.post('/api/agent', {
      name: name,
      description: description,
      agentImage: avatarImage,
      agentId: newAgentId
    });

    console.log(result.data);
    setIsLoading(false);
  }




  return (
    <main className="min-h-svh bg-background px-6 py-8 sm:px-10 lg:px-22">
      <div className="">
        <header>
          <h1 className="text-3xl font-bold tracking-normal text-foreground sm:text-4xl">
            Create New Agent
          </h1>
          <p className="mt-2 text-base text-muted-foreground sm:text-lg">
            Customize your agent and give it a clear purpose.
          </p>
        </header>

        <form className="mt-6 mx-auto w-full max-w-xl">
          <section className="flex flex-col items-center">
            <img src={`https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=${avatarSeed}`}
              className="h-28 w-28"
            />


            <Button
              className="mt-4 h-10 px-5 text-sm"
              type="button"
              variant="outline"
              onClick={shuffleAvatar}
            >
              <ShuffleIcon className="size-4" />
              Shuffle avatar
            </Button>
          </section>

          <section className="mx-auto mt-6 w-full max-w-3xl space-y-5">
            <div className="space-y-2">
              <Label
                className="text-base font-semibold text-foreground"
                htmlFor="agent-name"
              >
                Agent name
              </Label>
              <Input
                id="agent-name"
                name="name"
                className="h-12 rounded-md px-4 text-base shadow-sm md:text-base"
                placeholder="Enter agent name"
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline gap-4">
                <Label
                  className="text-base font-semibold text-foreground"
                  htmlFor="agent-description"
                >
                  Instructions / Description
                </Label>
                <span className="text-sm font-medium text-muted-foreground">
                  Optional
                </span>
              </div>
              <Textarea
                id="agent-description"
                name="description"
                className="min-h-32 resize-none rounded-md px-4 py-3 text-base shadow-sm md:text-base"
                maxLength={1000}
                placeholder="Describe what this agent should do, its personality, goals, or special instructions..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <p className="text-right text-sm text-muted-foreground">
                {description.length} / 1000
              </p>
            </div>
          </section>

          <div className="mx-auto mt-5 flex w-full max-w-3xl flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link href="/workspace">
              <Button
                className="h-11 w-full px-8 text-sm sm:w-auto"
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </Link>
            <Button className="h-11 px-8 text-sm" type="submit"
              onClick={onClickCreateAgent}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin" /> : null}
              Create Agent
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}

export default CreateAgent
