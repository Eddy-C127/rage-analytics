import supabase from './config/supabase.js';

async function checkPackages() {
    const { data, error } = await supabase
        .from('packages')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Campos en packages:');
    if (data && data[0]) {
        Object.keys(data[0]).forEach(key => {
            console.log(`  - ${key}: ${typeof data[0][key]} = ${JSON.stringify(data[0][key])}`);
        });
    }
}

checkPackages();
