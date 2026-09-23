"use client"
import { useSession } from 'next-auth/react'
import React, { useEffect } from 'react'
import axios from 'axios'

function Provider({ children }: { children: React.ReactNode }) {
    const { data } = useSession();


    useEffect(() => {
        data?.user?.email && createNewUser()
    }, [data])

    // Ensure every authenticated OAuth user has a matching local `users` row.
    // The API route owns the upsert logic so this client component only needs
    // to signal that the session is ready.
    const createNewUser = async () => {
        const result = await axios.post('/api/user', {});
        console.log(result.data);
    }

    return (
        <div>{children}</div>
    )
}

export default Provider
