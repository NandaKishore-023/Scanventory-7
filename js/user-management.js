let currentUsers = [];
let currentInvitations = [];
let currentWarehouses = [];

window.onload = async () => {
    await protectPage();
    
    // Check if user is owner
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    // Get user role
    const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    
    if (!profile || profile.role !== 'owner') {
        alert('Access denied. Only owners can access this page.');
        window.location.href = 'index.html';
        return;
    }
    
    await loadUser();
    await loadWarehouses();
    await loadUsers();
    await loadInvitations();
    await loadActivity();
    await loadInventoryTree();
};


function getBaseUrl() {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
        return 'http://localhost:5500';
    } else {
        return 'https://nandakishore-023.github.io/Scanventory-7';
    }
}


async function loadUser() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        // Get user profile
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .single();

        // Display username in sidebar
        const usernameEl = document.getElementById("username");
        if (usernameEl) {
            let displayName = 'User';
            
            if (profile?.full_name) {
                displayName = profile.full_name;
            } else if (user.user_metadata?.full_name) {
                displayName = user.user_metadata.full_name;
            } else if (user.email) {
                // Format email username nicely
                displayName = user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
            
            usernameEl.innerText = displayName;
        }
    } catch (err) {
        console.error('Error in loadUser:', err);
        // Fallback to email
        const { data: { user } } = await supabaseClient.auth.getUser();
        const usernameEl = document.getElementById("username");
        if (usernameEl && user?.email) {
            usernameEl.innerText = user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
    }
}

async function loadWarehouses() {
    const orgId = sessionStorage.getItem('orgId');
    const { data, error } = await supabaseClient
        .from('warehouses')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name');
    
    if (error) {
        console.error('Error loading warehouses:', error);
        return;
    }
    
    currentWarehouses = data;
    
    const container = document.getElementById('warehouseAccess');
    if (!container) return;
    
    container.innerHTML = '';
    
    data.forEach(w => {
        const div = document.createElement('div');
        div.className = 'warehouse-option';
        div.innerHTML = `
            <input type="checkbox" id="wh_${w.id}" value="${w.id}" checked>
            <label for="wh_${w.id}">${w.name}</label>
        `;
        container.appendChild(div);
    });
}

async function loadUsers() {
    const orgId = sessionStorage.getItem('orgId');
    const { data, error } = await supabaseClient
        .from('user_profiles')
        .select(`
            *,
            permissions (*)
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error loading users:', error);
        return;
    }
    
    currentUsers = data;
    
    // Update stats
    document.getElementById('totalUsers').innerText = data.length;
    document.getElementById('activeUsers').innerText = data.filter(u => u.role === 'employee').length;
    
    displayUsers(data);
}

function displayUsers(users) {
    const tbody = document.getElementById('usersList');
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    users.forEach(user => {
        if (user.role === 'owner') return; // Don't show owner in list
        
        const row = document.createElement('tr');
        
        const status = user.email?.includes('invited') ? 'pending' : 'active';
        const statusBadge = status === 'active' 
            ? '<span class="badge badge-employee">Active</span>'
            : '<span class="badge badge-pending">Pending</span>';
        
        const lastActive = user.last_sign_in_at 
            ? new Date(user.last_sign_in_at).toLocaleDateString()
            : 'Never';
        
        row.innerHTML = `
            <td>${user.employee_id || 'N/A'}</td>
            <td>${user.full_name || 'N/A'}</td>
            <td>${user.email || 'N/A'}</td>
            <td><span class="badge badge-employee">Employee</span></td>
            <td>${statusBadge}</td>
            <td>${lastActive}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-edit" onclick="editUser('${user.id}')">✏️</button>
                    <button class="btn-icon btn-reset" onclick="resetPassword('${user.id}')">🔑</button>
                    <button class="btn-icon btn-delete" onclick="deleteUser('${user.id}')">🗑️</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

async function loadInvitations() {
    const orgId = sessionStorage.getItem('orgId');
    const { data, error } = await supabaseClient
        .from('invitations')
        .select('*')
        .eq('status', 'pending')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error loading invitations:', error);
        return;
    }
    
    currentInvitations = data;
    document.getElementById('pendingInvites').innerText = data.length;
    displayInvitations(data);
}

function displayInvitations(invitations) {
    const tbody = document.getElementById('invitationsList');
    if (!tbody) return;
    
    if (invitations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px;">No pending invitations</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    invitations.forEach(inv => {
        const row = document.createElement('tr');
        const expiresAt = new Date(inv.expires_at).toLocaleDateString();
        
        row.innerHTML = `
            <td>${inv.email}</td>
            <td>${inv.employee_id}</td>
            <td>${inv.full_name}</td>
            <td>${expiresAt}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-edit" onclick="resendInvitation('${inv.id}')">📧</button>
                    <button class="btn-icon btn-delete" onclick="cancelInvitation('${inv.id}')">❌</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

async function createEmployee() {
    const fullName = document.getElementById('empFullName').value;
    const email = document.getElementById('empEmail').value;
    const employeeId = document.getElementById('empId').value;
    const orgId = sessionStorage.getItem('orgId');
    const ownerId = (await supabaseClient.auth.getUser()).data.user.id;
    
    // Get permissions
    const canCreate = document.getElementById('permCreate').checked;
    const canUpdate = document.getElementById('permUpdate').checked;
    const canDelete = document.getElementById('permDelete').checked;
    const canMove = document.getElementById('permMove').checked;
    
    // Get selected warehouses
    const warehouseCheckboxes = document.querySelectorAll('#warehouseAccess input[type="checkbox"]:checked');
    const selectedWarehouses = Array.from(warehouseCheckboxes).map(cb => cb.value);
    
    // Validation
    if (!fullName || !email || !employeeId) {
        alert('Please fill in all fields');
        return;
    }
    
    if (employeeId.length !== 10 || isNaN(employeeId)) {
        alert('Employee ID must be a 10-digit number');
        return;
    }
    
    try {
        // Check if employee ID already exists in this organization
        const { data: existingUser } = await supabaseClient
            .from('user_profiles')
            .select('id')
            .eq('employee_id', employeeId)
            .eq('organization_id', orgId)
            .maybeSingle();
        
        if (existingUser) {
            alert(`Employee ID ${employeeId} already exists in your organization`);
            return;
        }
        
        // Check if email already exists
        const { data: existingEmail } = await supabaseClient
            .from('user_profiles')
            .select('id')
            .eq('email', email)
            .eq('organization_id', orgId)
            .maybeSingle();
        
        if (existingEmail) {
            alert(`Email ${email} is already registered in your organization`);
            return;
        }
        
        // Generate a random password (not used for email, but required by Supabase)
        const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
        
        // Create the user account in Supabase Auth - EXACT same method as signup.html
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: tempPassword, // Temporary password
            options: {
                data: {
                    full_name: fullName,
                    employee_id: employeeId,
                    role: 'employee',
                    organization_id: orgId
                },
                emailRedirectTo: getBaseUrl() + '/login.html' // Same as signup.html
            }
        });

        if (authError) {
            console.error('Auth signup error:', authError);
            
            // If user already exists, offer to send password reset
            if (authError.message.includes('User already registered')) {
                const sendReset = confirm(
                    `This email is already registered. Do you want to send a password reset email instead?`
                );
                if (sendReset) {
                    await supabaseClient.auth.resetPasswordForEmail(email, {
                        redirectTo: getBaseUrl() + '/reset-password.html',
                    });
                    alert(`Password reset email sent to ${email}`);
                }
            } else {
                alert('Error creating user: ' + authError.message);
            }
            return;
        }

        if (!authData.user) {
            throw new Error('Failed to create user account');
        }

        console.log('Auth user created:', authData.user);

        // Create invitation record (for tracking)
        const { error: invError } = await supabaseClient
            .from('invitations')
            .insert([{
                email: email,
                employee_id: employeeId,
                full_name: fullName,
                created_by: ownerId,
                organization_id: orgId,
                status: 'pending' // Will be updated when employee first logs in
            }]);

        if (invError) {
            console.error('Error creating invitation record:', invError);
            // Don't throw - the user is already created
        }

        // Create permissions for the user
        if (selectedWarehouses.length > 0) {
            const permissions = selectedWarehouses.map(warehouseId => ({
                user_id: authData.user.id,
                can_create: canCreate,
                can_read: true,
                can_update: canUpdate,
                can_delete: canDelete,
                can_move: canMove,
                warehouse_id: warehouseId
            }));
            
            const { error: permError } = await supabaseClient
                .from('permissions')
                .insert(permissions);
            
            if (permError) {
                console.error('Error creating permissions:', permError);
            }
        }

        // Create a backup signup link (in case email doesn't arrive)
        const signupUrl = `${window.location.origin}/employee-signup.html?email=${encodeURIComponent(email)}&employeeId=${employeeId}&name=${encodeURIComponent(fullName)}&orgId=${orgId}`;
        
        // Display the invitation link
        document.getElementById('invitationLink').value = signupUrl;
        document.getElementById('invitationContainer').style.display = 'block';
        
        // Clear form
        document.getElementById('empFullName').value = '';
        document.getElementById('empEmail').value = '';
        document.getElementById('empId').value = '';
        
        // Show success message
        alert(`✅ Invitation sent to ${email}!\n\nAn email has been sent with instructions to set up their account.\n\nYou can also use the backup link below if the email doesn't arrive.`);
        
        // Refresh lists
        await loadUsers();
        await loadInvitations();
        
    } catch (error) {
        console.error('Error creating employee:', error);
        alert('Error creating employee: ' + error.message);
    }
}

async function resendInvitation(invitationId) {
    const invitation = currentInvitations.find(i => i.id === invitationId);
    if (!invitation) return;
    
    try {
        // Create the backup signup link
        const signupUrl = `${window.location.origin}/employee-signup.html?email=${encodeURIComponent(invitation.email)}&employeeId=${invitation.employee_id}&name=${encodeURIComponent(invitation.full_name)}&orgId=${invitation.organization_id}`;
        
        // Check if user already exists
        const { data: existingUser } = await supabaseClient
            .from('user_profiles')
            .select('id, email')
            .eq('employee_id', invitation.employee_id)
            .maybeSingle();
        
        if (existingUser) {
            // User exists, send password reset (same as forgot password)
            const { error } = await supabaseClient.auth.resetPasswordForEmail(invitation.email, {
                redirectTo: getBaseUrl() + '/reset-password.html',
            });
            
            if (error) throw error;
            
            alert(`✅ Password reset email sent to ${invitation.email}`);
        } else {
            // User doesn't exist, create new invitation (EXACT same as signup.html)
            const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
            
            const { error } = await supabaseClient.auth.signUp({
                email: invitation.email,
                password: tempPassword,
                options: {
                    data: {
                        full_name: invitation.full_name,
                        employee_id: invitation.employee_id,
                        role: 'employee',
                        organization_id: invitation.organization_id
                    },
                    emailRedirectTo: getBaseUrl() + '/login.html'
                }
            });
            
            if (error) throw error;
            
            alert(`✅ New invitation sent to ${invitation.email}!`);
        }
        
        // Also show the backup link
        document.getElementById('invitationLink').value = signupUrl;
        document.getElementById('invitationContainer').style.display = 'block';
        
    } catch (error) {
        console.error('Error resending invitation:', error);
        
        // If email fails, at least provide the link
        const signupUrl = `${window.location.origin}/employee-signup.html?email=${encodeURIComponent(invitation.email)}&employeeId=${invitation.employee_id}&name=${encodeURIComponent(invitation.full_name)}&orgId=${invitation.organization_id}`;
        
        await navigator.clipboard.writeText(signupUrl);
        alert(`⚠️ Could not send email. Invitation link copied to clipboard instead!\n\n${signupUrl}`);
    }
}

function copyInvitationLink() {
    const linkInput = document.getElementById('invitationLink');
    linkInput.select();
    document.execCommand('copy');
    alert('Credentials copied to clipboard!');
}

async function editUser(userId) {
    const user = currentUsers.find(u => u.id === userId);
    const userPermissions = user.permissions || [];
    
    // Get unique warehouses from permissions
    const permittedWarehouses = userPermissions.map(p => p.warehouse_id);
    
    let warehouseOptions = '';
    currentWarehouses.forEach(w => {
        const checked = permittedWarehouses.includes(w.id) ? 'checked' : '';
        warehouseOptions += `
            <div class="warehouse-option">
                <input type="checkbox" id="edit_wh_${w.id}" value="${w.id}" ${checked}>
                <label for="edit_wh_${w.id}">${w.name}</label>
            </div>
        `;
    });
    
    const permissions = userPermissions[0] || {};
    
    document.getElementById('modalTitle').innerText = 'Edit User';
    document.getElementById('editModal').style.display = 'block';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="editName" value="${user.full_name || ''}">
        </div>
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="editEmail" value="${user.email || ''}">
        </div>
        <div class="form-group">
            <label>Employee ID</label>
            <input type="text" id="editEmpId" value="${user.employee_id || ''}" maxlength="10">
        </div>
        
        <h4>Permissions</h4>
        <div class="permissions-grid">
            <div class="permission-item">
                <input type="checkbox" id="editPermCreate" ${permissions.can_create ? 'checked' : ''}>
                <label for="editPermCreate">Create</label>
            </div>
            <div class="permission-item">
                <input type="checkbox" id="editPermUpdate" ${permissions.can_update ? 'checked' : ''}>
                <label for="editPermUpdate">Update</label>
            </div>
            <div class="permission-item">
                <input type="checkbox" id="editPermDelete" ${permissions.can_delete ? 'checked' : ''}>
                <label for="editPermDelete">Delete</label>
            </div>
            <div class="permission-item">
                <input type="checkbox" id="editPermMove" ${permissions.can_move ? 'checked' : ''}>
                <label for="editPermMove">Move Items</label>
            </div>
        </div>
        
        <h4>Warehouse Access</h4>
        <div class="warehouse-select">
            ${warehouseOptions}
        </div>
        
        <button class="btn btn-success" onclick="updateUser('${userId}')">Update User</button>
    `;
}

async function updateUser(userId) {
    const name = document.getElementById('editName').value;
    const email = document.getElementById('editEmail').value;
    const employeeId = document.getElementById('editEmpId').value;
    
    const canCreate = document.getElementById('editPermCreate').checked;
    const canUpdate = document.getElementById('editPermUpdate').checked;
    const canDelete = document.getElementById('editPermDelete').checked;
    const canMove = document.getElementById('editPermMove').checked;
    
    const warehouseCheckboxes = document.querySelectorAll('#modalBody .warehouse-option input[type="checkbox"]:checked');
    const selectedWarehouses = Array.from(warehouseCheckboxes).map(cb => cb.value);
    
    if (!name || !email || !employeeId) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        // Update user profile
        const { error: profileError } = await supabaseClient
            .from('user_profiles')
            .update({ full_name: name, employee_id: employeeId })
            .eq('id', userId);
        
        if (profileError) throw profileError;
        
        // Delete old permissions
        const { error: deleteError } = await supabaseClient
            .from('permissions')
            .delete()
            .eq('user_id', userId);
        
        if (deleteError) throw deleteError;
        
        // Create new permissions
        if (selectedWarehouses.length > 0) {
            const permissions = selectedWarehouses.map(warehouseId => ({
                user_id: userId,
                can_create: canCreate,
                can_read: true,
                can_update: canUpdate,
                can_delete: canDelete,
                can_move: canMove,
                warehouse_id: warehouseId
            }));
            
            const { error: permError } = await supabaseClient
                .from('permissions')
                .insert(permissions);
            
            if (permError) throw permError;
        }
        
        alert('User updated successfully!');
        closeModal();
        loadUsers();
        
    } catch (error) {
        console.error('Error updating user:', error);
        alert('Error updating user: ' + error.message);
    }
}

async function resetPassword(userId) {
    if (!confirm('Send password reset email to this user?')) return;
    
    try {
        const { data: user } = await supabaseClient
            .from('user_profiles')
            .select('email')
            .eq('id', userId)
            .single();
        
        if (!user) throw new Error('User not found');
        
        const { error } = await supabaseClient.auth.admin.generateLink({
            type: 'recovery',
            email: user.email
        });
        
        if (error) throw error;
        
        alert('Password reset email sent!');
        
    } catch (error) {
        console.error('Error resetting password:', error);
        alert('Error resetting password: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
        // Delete permissions first
        await supabaseClient
            .from('permissions')
            .delete()
            .eq('user_id', userId);
        
        // Delete user profile
        await supabaseClient
            .from('user_profiles')
            .delete()
            .eq('id', userId);
        
        // Delete auth user (admin only)
        const { error } = await supabaseClient.auth.admin.deleteUser(userId);
        
        if (error) throw error;
        
        alert('User deleted successfully!');
        loadUsers();
        
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user: ' + error.message);
    }
}

async function resendInvitation(invitationId) {
    const invitation = currentInvitations.find(i => i.id === invitationId);
    if (!invitation) return;
    
    try {
        // Check if user already exists
        const { data: existingUser } = await supabaseClient
            .from('user_profiles')
            .select('id')
            .eq('employee_id', invitation.employee_id)
            .maybeSingle();
        
        if (existingUser) {
            alert('User already exists. The invitation will be removed.');
            await supabaseClient
                .from('invitations')
                .delete()
                .eq('id', invitationId);
            loadInvitations();
            loadUsers();
            return;
        }
        
        // Generate a password reset link (this sends email)
        const { error } = await supabaseClient.auth.admin.generateLink({
            type: 'recovery',
            email: invitation.email
        });
        
        if (error) throw error;
        
        alert(`Password reset email sent to ${invitation.email}. They can use it to set up their account.`);
        
    } catch (error) {
        console.error('Error resending invitation:', error);
        
        // If user doesn't exist, create them
        if (error.message.includes('User not found')) {
            try {
                const { error: createError } = await supabaseClient.auth.admin.createUser({
                    email: invitation.email,
                    password: 'Temp@123',
                    email_confirm: false,
                    user_metadata: {
                        full_name: invitation.full_name,
                        employee_id: invitation.employee_id,
                        role: 'employee'
                    }
                });
                
                if (createError) throw createError;
                
                alert(`New invitation sent to ${invitation.email}!`);
                
            } catch (createErr) {
                alert('Error creating user: ' + createErr.message);
            }
        } else {
            alert('Error resending invitation: ' + error.message);
        }
    }
}

async function cancelInvitation(invitationId) {
    if (!confirm('Cancel this invitation?')) return;
    
    try {
        await supabaseClient
            .from('invitations')
            .delete()
            .eq('id', invitationId);
        
        alert('Invitation cancelled');
        loadInvitations();
        
    } catch (error) {
        console.error('Error cancelling invitation:', error);
        alert('Error cancelling invitation: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

// Add this to your existing auth.js or here
async function loadActivity() {
    try {
        const orgId = sessionStorage.getItem('orgId');
        if (!orgId) return;

        // First, get the activities
        const { data: activities, error: activitiesError } = await supabaseClient
            .from("activity_logs")
            .select('*')
            .eq('organization_id', orgId)
            .order("created_at", { ascending: false })
            .limit(20);

        if (activitiesError) {
            console.error('Error loading activities:', activitiesError);
            return;
        }

        // If there are activities, get the user profiles for each user_id
        let userProfiles = {};
        if (activities && activities.length > 0) {
            // Get unique user_ids
            const userIds = [...new Set(activities.map(a => a.user_id).filter(id => id))];
            
            if (userIds.length > 0) {
                const { data: profiles } = await supabaseClient
                    .from('user_profiles')
                    .select('id, full_name, email')
                    .in('id', userIds);
                
                // Create a map of user_id to profile
                if (profiles) {
                    profiles.forEach(p => {
                        userProfiles[p.id] = p;
                    });
                }
            }
        }

        const container = document.getElementById("activityList");
        if (!container) return;
        
        container.innerHTML = "";

        if (!activities || activities.length === 0) {
            container.innerHTML = "<p class='no-activity'>No recent activity</p>";
            return;
        }

        activities.forEach(a => {
            const activityItem = document.createElement("div");
            activityItem.className = "activity-item";
            
            // Get user info from our profiles map
            const userProfile = userProfiles[a.user_id] || {};
            const userName = userProfile.full_name || 
                            (userProfile.email ? userProfile.email.split('@')[0] : 'Unknown User');
            
            const activityTime = new Date(a.created_at);
            const timeAgo = getTimeAgo(activityTime);
            const { icon, color } = getActivityIcon(a.action);
            
            let actionText = a.description || `${a.action} ${a.entity_type || ''}`;
            
            activityItem.innerHTML = `
                <div class="activity-item-header">
                    <span class="activity-user">${userName}</span>
                    <span class="activity-time" title="${activityTime.toLocaleString()}">${timeAgo}</span>
                </div>
                <div class="activity-item-body" style="border-left-color: ${color}">
                    <span class="activity-icon">${icon}</span>
                    <span class="activity-text">${actionText}</span>
                </div>
            `;
            
            container.appendChild(activityItem);
        });
    } catch (err) {
        console.error('Error in loadActivity:', err);
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function getActivityIcon(action) {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('insert') || actionLower.includes('add')) {
        return { icon: '➕', color: '#4caf50' };
    } else if (actionLower.includes('update') || actionLower.includes('edit')) {
        return { icon: '✏️', color: '#ff9800' };
    } else if (actionLower.includes('delete')) {
        return { icon: '❌', color: '#f44336' };
    } else if (actionLower.includes('move')) {
        return { icon: '↗️', color: '#2196f3' };
    } else {
        return { icon: '•', color: '#757575' };
    }
}

// Click outside modal to close
window.onclick = function(event) {
    const modal = document.getElementById("editModal");
    if (event.target === modal) {
        closeModal();
    }
};