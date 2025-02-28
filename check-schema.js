const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://ezclbieisztdxwzltjnl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6Y2xiaWVpc3p0ZHh3emx0am5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk5OTk5MDQsImV4cCI6MjA1NTU3NTkwNH0.8uz2LIXut96rLpSNshqeUADQyuhpIGYOW6QFDmFhfeo'
);

async function checkSchema() {
  try {
    // Get the schema of the videos table
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching data:', error);
      return;
    }

    // Check if there's at least one record
    if (data && data.length > 0) {
      console.log('Columns in videos table:', Object.keys(data[0]));
    } else {
      console.log('No records found in videos table');
      
      // Try to insert a test record to see what columns are required
      const { error: insertError } = await supabase
        .from('videos')
        .insert({
          id: 'test-id',
          project_id: 'test-project',
          display_name: 'Test Video',
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Error inserting test record:', insertError);
      } else {
        console.log('Test record inserted successfully');
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkSchema(); 