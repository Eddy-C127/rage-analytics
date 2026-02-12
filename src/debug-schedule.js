import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
    // Check sessions table structure
    console.log('\n=== SESSIONS TABLE ===');
    const { data: sessions, error: sesErr } = await supabase
        .from('sessions')
        .select('*')
        .limit(3);

    if (sesErr) {
        console.log('Sessions error:', sesErr.message);
    } else if (!sessions || sessions.length === 0) {
        console.log('No sessions found');
    } else {
        console.log('Sample session:', JSON.stringify(sessions[0], null, 2));
        console.log('Columns:', Object.keys(sessions[0]).join(', '));
    }

    // Check bookings table structure
    console.log('\n=== BOOKINGS TABLE ===');
    const thirtyDaysAgo = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    const { data: bookings, error: bookErr } = await supabase
        .from('bookings')
        .select('*')
        .gte('session_date', thirtyDaysAgo)
        .limit(3);

    if (bookErr) {
        console.log('Bookings error:', bookErr.message);
    } else if (!bookings || bookings.length === 0) {
        console.log('No bookings in last 30 days');
    } else {
        console.log('Sample booking:', JSON.stringify(bookings[0], null, 2));
        console.log('Columns:', Object.keys(bookings[0]).join(', '));
    }

    // Count total sessions
    const { count: sessionCount } = await supabase.from('sessions').select('*', { count: 'exact', head: true });
    console.log('\nTotal sessions:', sessionCount);

    process.exit(0);
}

debug();
