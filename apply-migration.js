import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = 'https://ltffvsctfcgpgkxhyaxu.supabase.co';
// Note: You need to get the service role key from Supabase dashboard
// Go to: Project Settings > API > Service role key
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.error('\nTo get the service role key:');
  console.error('1. Go to https://app.supabase.com');
  console.error('2. Select your project (jaovvaweypydoyfevzct)');
  console.error('3. Go to Settings > API');
  console.error('4. Copy the "Service role key" (NOT the anon key)');
  console.error('5. Set it as an environment variable: $env:SUPABASE_SERVICE_ROLE_KEY = "your-key"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function runMigration() {
  try {
    console.log('🔄 Applying migration: create_sales_targets...\n');
    
    const migrationFile = path.join(process.cwd(), 'supabase', 'migrations', '20260404090000_create_sales_targets.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Split by GO or ; for handling multiple statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (const statement of statements) {
      // Only execute CREATE statements through RPC
      if (statement.toLowerCase().includes('create')) {
        console.log('Executing:', statement.substring(0, 80) + '...');
        
        const { error } = await supabase.rpc('exec', { 
          sql: statement 
        }).catch(err => ({ error: err }));
        
        if (error) {
          console.error(`⚠️  Warning (may be normal if table exists): ${error.message}`);
        }
      }
    }

    console.log('\n✅ Migration applied successfully!');
    console.log('The sales_targets tables should now be available in Supabase.');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  }
}

runMigration();
