const SUPABASE_URL = "https://iqxhclivntzsholfgwdv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxeGhjbGl2bnR6c2hvbGZnd2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzA4MjMsImV4cCI6MjA4NzAwNjgyM30.KTqcHlTiCEMG_QvBVM826sGDr4qVnlPSFW43d6YasTE";

// Check if supabase is available
if (typeof window.supabase === 'undefined') {
    console.error('Supabase library not loaded!');
}

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// Make sure it's globally available
window.supabaseClient = supabaseClient;

console.log('✅ Supabase client initialized');

async function getCurrentOrganizationId() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            console.log('No user logged in');
            return null;
        }
        
        // First check session storage
        const sessionOrgId = sessionStorage.getItem('orgId');
        if (sessionOrgId) {
            return sessionOrgId;
        }
        
        // If not in session, get from profile
        const { data: profile, error } = await supabaseClient
            .from('user_profiles')
            .select('role, organization_id')
            .eq('id', user.id)
            .single();
        
        if (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
        
        let orgId;
        if (profile?.role === 'owner') {
            orgId = user.id; // Owner's ID is the organization ID
        } else {
            orgId = profile?.organization_id; // Employee's organization ID
        }
        
        if (orgId) {
            sessionStorage.setItem('orgId', orgId);
            console.log('Stored orgId in session:', orgId);
        }
        
        return orgId;
    } catch (err) {
        console.error('Error in getCurrentOrganizationId:', err);
        return null;
    }
}

// Make helper functions available globally
window.getCurrentOrganizationId = getCurrentOrganizationId;