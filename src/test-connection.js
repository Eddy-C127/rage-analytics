import supabase from './config/supabase.js';

async function testConnection() {
    console.log('🔗 Testing Supabase connection...\n');

    try {
        // Test profiles table
        const { data: profiles, error: profilesError, count: profilesCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        if (profilesError) throw profilesError;
        console.log(`✅ Profiles: ${profilesCount} registros`);

        // Test packages table
        const { data: packages, error: packagesError } = await supabase
            .from('packages')
            .select('*');

        if (packagesError) throw packagesError;
        console.log(`✅ Packages: ${packages?.length || 0} tipos de paquetes`);
        if (packages) {
            packages.forEach(p => console.log(`   - ${p.name}: $${p.price} (${p.credits} créditos)`));
        }

        // Test purchases table
        const { count: purchasesCount, error: purchasesError } = await supabase
            .from('purchases')
            .select('*', { count: 'exact', head: true });

        if (purchasesError) throw purchasesError;
        console.log(`✅ Purchases: ${purchasesCount} compras registradas`);

        // Test bookings table
        const { count: bookingsCount, error: bookingsError } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true });

        if (bookingsError) throw bookingsError;
        console.log(`✅ Bookings: ${bookingsCount} reservaciones`);

        // Test credit_batches table
        const { count: creditBatchesCount, error: creditBatchesError } = await supabase
            .from('credit_batches')
            .select('*', { count: 'exact', head: true });

        if (creditBatchesError) throw creditBatchesError;
        console.log(`✅ Credit Batches: ${creditBatchesCount} lotes de créditos`);

        console.log('\n🎉 ¡Conexión exitosa! Todos los datos están accesibles.\n');

    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        process.exit(1);
    }
}

testConnection();
