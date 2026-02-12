import supabase from './config/supabase.js';

async function exploreSchema() {
    console.log('🔍 Explorando estructura de tablas...\n');

    const tables = [
        'packages',
        'purchases',
        'credit_batches',
        'credit_history',
        'user_available_credits',
        'bookings',
        'profiles',
        'sessions',
        'coaches'
    ];

    for (const tableName of tables) {
        console.log(`\n📋 Tabla: ${tableName}`);
        console.log('─'.repeat(50));

        try {
            // Obtener un registro para ver la estructura
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);

            if (error) {
                console.log(`   ❌ Error: ${error.message}`);
                continue;
            }

            if (data && data.length > 0) {
                const sample = data[0];
                console.log('   Campos encontrados:');
                Object.keys(sample).forEach(key => {
                    const value = sample[key];
                    const type = value === null ? 'null' : typeof value;
                    console.log(`   - ${key}: ${type} (ejemplo: ${JSON.stringify(value)?.substring(0, 50)})`);
                });
            } else {
                console.log('   ⚠️  Sin datos (tabla vacía o sin permiso)');
            }

            // Obtener count
            const { count } = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true });

            console.log(`   📊 Total registros visibles: ${count || 0}`);

        } catch (err) {
            console.log(`   ❌ Error: ${err.message}`);
        }
    }

    // Ahora veamos qué podemos hacer con los datos disponibles
    console.log('\n\n🎯 ANÁLISIS DETALLADO DE DATOS DISPONIBLES\n');
    console.log('═'.repeat(60));

    // Packages con detalle
    console.log('\n📦 PAQUETES:');
    const { data: packages } = await supabase.from('packages').select('*');
    if (packages && packages.length > 0) {
        console.log(JSON.stringify(packages, null, 2));
    }

    // Credit Batches - muestra de estructura
    console.log('\n\n🎟️ CREDIT BATCHES (muestra):');
    const { data: batches } = await supabase.from('credit_batches').select('*').limit(3);
    if (batches && batches.length > 0) {
        console.log(JSON.stringify(batches, null, 2));
    }

    // Bookings - muestra de estructura
    console.log('\n\n📅 BOOKINGS (muestra):');
    const { data: bookings } = await supabase.from('bookings').select('*').limit(3);
    if (bookings && bookings.length > 0) {
        console.log(JSON.stringify(bookings, null, 2));
    }

    // Sessions
    console.log('\n\n🧘 SESSIONS:');
    const { data: sessions } = await supabase.from('sessions').select('*');
    if (sessions && sessions.length > 0) {
        console.log(JSON.stringify(sessions, null, 2));
    }
}

exploreSchema().catch(console.error);
