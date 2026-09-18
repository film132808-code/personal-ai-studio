import { createClient } from '@/lib/supabase/server'

export default async function DebugPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  let tables: any = {}
  let tableErrors: any = {}
  
  const checkTable = async (name: string) => {
    try {
      const { data, error } = await supabase.from(name).select('*').limit(1)
      if (error) {
        tableErrors[name] = error.message
        return false
      }
      tables[name] = `OK - ${data?.length || 0} rows`
      return true
    } catch (e: any) {
      tableErrors[name] = e.message
      return false
    }
  }
  
  await checkTable('profiles')
  await checkTable('provider_connections')
  await checkTable('conversations')
  await checkTable('messages')
  await checkTable('models_cache')
  
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug - Supabase Status</h1>
      
      <div className="space-y-4">
        <div className="p-4 border rounded-xl">
          <h2 className="font-semibold">User Auth</h2>
          <p className="text-sm mt-2">User: {user?.email || 'Not logged in'}</p>
          <p className="text-sm">ID: {user?.id || 'N/A'}</p>
          {userError && <p className="text-sm text-red-600">Error: {userError.message}</p>}
        </div>
        
        <div className="p-4 border rounded-xl">
          <h2 className="font-semibold">Env Vars</h2>
          <p className="text-sm mt-2">URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</p>
          <p className="text-sm">Anon Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</p>
          <p className="text-sm">Service Role: {process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}</p>
          <p className="text-sm">Encryption: {process.env.ENCRYPTION_KEY ? '✅ Set' : '❌ Missing'}</p>
        </div>
        
        <div className="p-4 border rounded-xl">
          <h2 className="font-semibold">Tables</h2>
          <div className="mt-2 space-y-2">
            {Object.keys({ ...tables, ...tableErrors }).map(name => (
              <div key={name} className="flex justify-between text-sm">
                <span>{name}</span>
                <span className={tableErrors[name] ? 'text-red-600' : 'text-green-600'}>
                  {tables[name] || `❌ ${tableErrors[name]}`}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {Object.keys(tableErrors).length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <h3 className="font-semibold text-red-800">⚠️ Tables Missing!</h3>
            <p className="text-sm text-red-700 mt-2">You need to run supabase-migration-fixed.sql in Supabase SQL Editor</p>
            <p className="text-xs text-red-600 mt-2">Errors: {JSON.stringify(tableErrors, null, 2)}</p>
          </div>
        )}
        
        <div className="flex gap-2">
          <a href="/login" className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm">Go to Login</a>
          <a href="/" className="px-4 py-2 border rounded-xl text-sm">Go to Home</a>
        </div>
      </div>
    </div>
  )
}
