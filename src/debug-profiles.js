import supabase from './config/supabase.js';

async function debugProfiles() {
    console.log('🔍 Debugging profiles access...\n');
    console.log('Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');

    // Test 1: Try to get count
    console.log('\n1. Trying to get profiles count...');
    const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.log('   ❌ Error:', countError.message);
    } else {
        console.log(`   ✅ Count: ${count} profiles`);
    }

    // Test 2: Try to get actual data
    console.log('\n2. Trying to fetch profiles data...');
    const { data, error: dataError } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .limit(5);

    if (dataError) {
        console.log('   ❌ Error:', dataError.message);
    } else if (!data || data.length === 0) {
        console.log('   ⚠️  No data returned (empty or RLS blocking)');
    } else {
        console.log(`   ✅ Got ${data.length} profiles:`);
        data.forEach(p => {
            console.log(`      - ${p.full_name || 'NULL'} | ${p.phone || 'NULL'} | ${p.id.substring(0, 8)}...`);
        });
    }

    // Test 3: Check what key is being used
    console.log('\n3. Environment check:');
    console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
    console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
}

debugProfiles().catch(console.error);
