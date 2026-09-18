import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatApp from '@/components/ChatApp'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <ChatApp userEmail={user.email || 'User'} userId={user.id} />
}
