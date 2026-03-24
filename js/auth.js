
function getBaseUrl() {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
        return 'http://localhost:5500';
    } else {
        return 'https://nandakishore-023.github.io/Scanventory-7';
    }
}


// Make sure supabaseClient is available
if (typeof window.supabaseClient === 'undefined') {
    console.error('supabaseClient not loaded before auth.js');
}

async function login(email, password) {
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            alert(error.message);
        } else {
            // Use the base URL for redirect
            window.location.href = getBaseUrl() + "/index.html";
        }
    } catch (err) {
        console.error('Login error:', err);
        alert('Login failed: ' + err.message);
    }
}

async function logout() {
    try {
        await supabaseClient.auth.signOut();
        sessionStorage.clear();
        window.location.href = getBaseUrl() + "/login.html";
    } catch (err) {
        console.error('Logout error:', err);
    }
}

async function protectPage() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            window.location.href = getBaseUrl() + "/login.html";
            return false;
        }
        return true;
    } catch (err) {
        console.error('protectPage error:', err);
        window.location.href = getBaseUrl() + "/login.html";
        return false;
    }
}

async function getUserRole() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return null;
        
        const { data } = await supabaseClient
            .from('user_profiles')
            .select('role, organization_id')
            .eq('id', user.id)
            .single();
        
        return data;
    } catch (err) {
        console.error('getUserRole error:', err);
        return null;
    }
}

async function requireOwner() {
    const profile = await getUserRole();
    if (!profile || profile.role !== 'owner') {
        window.location.href = 'index.html';
        alert('Access denied. Owner privileges required.');
        return false;
    }
    return profile;
}

// Make functions globally available
window.login = login;
window.logout = logout;
window.protectPage = protectPage;
window.getUserRole = getUserRole;
window.requireOwner = requireOwner;

// New function to check if user has access to a resource
async function checkResourceAccess(resourceType, resourceId) {
    const orgId = await getCurrentOrganizationId();
    if (!orgId) return false;
    
    const { data } = await supabaseClient
        .from(resourceType)
        .select('id')
        .eq('id', resourceId)
        .eq('organization_id', orgId)
        .single();
    
    return !!data;
}