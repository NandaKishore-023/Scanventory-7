let searchMode = false;

window.onload = async () => {
    await protectPage();
    loadUser();
    loadWarehouses();
    loadStats();
    loadActivity();
    loadRecentItems();
    await loadInventoryTree();
    
    // Add click handlers to rack cards
    setupRackClickHandlers();
};


async function loadInventoryTree() {
    const tree = document.getElementById("inventoryTree");
    tree.innerHTML = "";
    
    const orgId = sessionStorage.getItem('orgId');
    if (!orgId) {
        console.error('No organization ID found');
        tree.innerHTML = '<p class="no-data">No organization found</p>';
        return;
    }

    const { data: warehouses } = await supabaseClient
        .from("warehouses")
        .select("*")
        .eq('organization_id', orgId);

    if (!warehouses || warehouses.length === 0) {
        tree.innerHTML = '<p class="no-data">No warehouses found</p>';
        return;
    }

    warehouses.forEach(w => {
        const warehouseNode = createTreeNode("🏢", w.name, "warehouse", w.id);
        tree.appendChild(warehouseNode);
    });
}



async function loadUser() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        // First check if profile exists
        let { data: profile, error } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        // If no profile exists, create one (for backward compatibility)
        if (error && error.code === 'PGRST116') {
            console.log('No profile found, creating one...');
            
            // Determine if this is an owner or employee
            const isOwner = !user.email?.includes('employee'); // Simple heuristic
            const role = isOwner ? 'owner' : 'employee';
            
            const { data: newProfile, error: createError } = await supabaseClient
                .from('user_profiles')
                .insert([{
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
                    role: role,
                    organization_id: isOwner ? user.id : null
                }])
                .select()
                .single();
            
            if (createError) {
                console.error('Error creating profile:', createError);
            } else {
                profile = newProfile;
            }
        }

        // Display username in sidebar - FIXED: Show name, not email
        const usernameEl = document.getElementById("username");
        if (usernameEl) {
            // Get display name from profile or metadata
            let displayName = 'User';
            
            if (profile?.full_name) {
                displayName = profile.full_name;
            } else if (user.user_metadata?.full_name) {
                displayName = user.user_metadata.full_name;
            } else if (user.email) {
                // Only use email if no name is available, but format it nicely
                displayName = user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
            
            usernameEl.innerText = displayName;
        }
        
        // Store organization ID
        if (profile) {
            const orgId = profile.organization_id || user.id;
            sessionStorage.setItem('orgId', orgId);
            sessionStorage.setItem('userRole', profile.role || 'owner');
            console.log('User loaded:', { orgId, role: profile.role });
        }
    } catch (err) {
        console.error('Error in loadUser:', err);
    }
}

async function loadWarehouses() {
    const orgId = sessionStorage.getItem('orgId');
    let query = supabaseClient.from("warehouses").select("*");
    
    // Only filter by orgId if it exists
    if (orgId) {
        query = query.eq('organization_id', orgId);
    }
    
    const { data } = await query.order("name");

    const select = document.getElementById("warehouseSelect");
    select.innerHTML = '<option value="">Select Warehouse</option>';

    if (data && data.length > 0) {
        data.forEach(w => {
            select.innerHTML += `<option value="${w.id}">${w.name}</option>`;
        });

        select.value = data[0].id;
        loadWarehouseData(data[0].id);
    } else {
        // Show empty state
        clearWarehouseData();
    }
}

function clearWarehouseData() {
    document.getElementById("rackCount").innerText = "0";
    document.getElementById("shelfCount").innerText = "0";
    document.getElementById("boxCount").innerText = "0";
    document.getElementById("itemCount").innerText = "0";
    document.getElementById("rackCards").innerHTML = '<p class="no-data">Select a warehouse to view racks</p>';
}

async function loadWarehouseData(id) {
    const orgId = sessionStorage.getItem('orgId');
    
    // Check if elements exist before updating them
    const rackCountEl = document.getElementById("rackCount");
    const shelfCountEl = document.getElementById("shelfCount");
    const boxCountEl = document.getElementById("boxCount");
    const itemCountEl = document.getElementById("itemCount");
    const totalItemsEl = document.getElementById("totalItems");
    const warehouseValueEl = document.getElementById("warehouseValue");
    
    const racks = await supabaseClient
        .from("racks")
        .select("*")
        .eq("warehouse_id", id)
        .eq('organization_id', orgId);
        
    const shelves = await supabaseClient
        .from("shelves")
        .select("*")
        .eq("warehouse_id", id)
        .eq('organization_id', orgId);
        
    const boxes = await supabaseClient
        .from("boxes")
        .select("*")
        .eq("warehouse_id", id)
        .eq('organization_id', orgId);
        
    const items = await supabaseClient
        .from("items")
        .select("value, quantity")
        .eq("warehouse_id", id)
        .eq('organization_id', orgId);

    // Calculate total value for this warehouse
    let warehouseValue = 0;
    items.data?.forEach(item => {
        warehouseValue += (item.value || 0) * (item.quantity || 0);
    });

    // Only update elements that exist
    if (rackCountEl) rackCountEl.innerText = racks.data.length;
    if (shelfCountEl) shelfCountEl.innerText = shelves.data.length;
    if (boxCountEl) boxCountEl.innerText = boxes.data.length;
    if (itemCountEl) itemCountEl.innerText = items.data?.length || 0;
    
    if (totalItemsEl) totalItemsEl.innerText = items.data?.length || 0;
    
    // Add warehouse value to the occupancy grid
    const occupancyGrid = document.querySelector('.occupancy-grid');
    if (occupancyGrid && !document.getElementById('warehouseValueContainer')) {
        // Add warehouse value if not already present
        const valueContainer = document.createElement('p');
        valueContainer.id = 'warehouseValueContainer';
        valueContainer.innerHTML = `Warehouse Value: <span id="warehouseValue">₹${warehouseValue.toLocaleString()}</span>`;
        occupancyGrid.appendChild(valueContainer);
    } else if (warehouseValueEl) {
        warehouseValueEl.innerText = `₹${warehouseValue.toLocaleString()}`;
    }

    renderRackCards(racks.data);
    
    // Refresh the stats to update the pie chart
    loadStats();
}

function renderRackCards(racks) {
    const container = document.getElementById("rackCards");
    container.innerHTML = "";

    if (racks.length === 0) {
        container.innerHTML = '<p class="no-data">No racks found in this warehouse</p>';
        return;
    }

    racks.forEach(r => {
        const card = document.createElement("div");
        card.className = "rack-card clickable";
        card.dataset.rackId = r.id;
        card.dataset.rackName = r.name;
        card.dataset.warehouseId = r.warehouse_id;
        
        // Get item count for this rack
        getRackItemCount(r.id).then(count => {
            card.innerHTML = `
                <div class="rack-icon">🗄️</div>
                <h4>${r.name}</h4>
                <div class="rack-details">
                    <span class="rack-items">📦 ${count} items</span>
                    <span class="rack-id">ID: ${r.id.substring(0, 8)}...</span>
                </div>
            `;
        });
        
        container.appendChild(card);
    });
    
    setupRackClickHandlers();
}

async function getRackItemCount(rackId) {
    const { data } = await supabaseClient
        .from("items")
        .select("id")
        .eq("rack_id", rackId);
    return data ? data.length : 0;
}

function setupRackClickHandlers() {
    document.querySelectorAll('.rack-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            const rackId = card.dataset.rackId;
            const rackName = card.dataset.rackName;
            const warehouseId = card.dataset.warehouseId;
            
            // Navigate to inventory.html with rack pre-selected
            window.location.href = `inventory.html?tab=racks&rack=${rackId}&warehouse=${warehouseId}`;
        });
    });
}

async function loadStats() {
    const orgId = sessionStorage.getItem('orgId');
    
    // Get all warehouses
    const { data: warehouses } = await supabaseClient
        .from("warehouses")
        .select("id, name")
        .eq('organization_id', orgId);
    
    if (!warehouses || warehouses.length === 0) {
        document.getElementById("totalValue").innerText = '₹ 0';
        document.getElementById("warehouseValueBreakdown").innerHTML = '<div class="breakdown-item">No warehouses found</div>';
        showEmptyChart();
        return;
    }
    
    // Calculate total stock value across all warehouses
    const { data: allItems } = await supabaseClient
        .from("items")
        .select("value, quantity, warehouse_id")
        .eq('organization_id', orgId);
    
    let totalValue = 0;
    let totalItems = 0;
    
    // Create a map to store warehouse values
    const warehouseValues = {};
    
    // Initialize warehouse values to 0
    warehouses.forEach(w => {
        warehouseValues[w.id] = {
            name: w.name,
            value: 0
        };
    });
    
    // Calculate values per warehouse
    allItems?.forEach(item => {
        const itemValue = (item.value || 0) * (item.quantity || 0);
        totalValue += itemValue;
        totalItems += item.quantity || 0;
        
        if (warehouseValues[item.warehouse_id]) {
            warehouseValues[item.warehouse_id].value += itemValue;
        }
    });
    
    // Update total value
    document.getElementById("totalValue").innerText = `₹ ${totalValue.toLocaleString()}`;
    
    // Create warehouse breakdown HTML
    const breakdownContainer = document.getElementById("warehouseValueBreakdown");
    let breakdownHTML = '';
    
    // Sort warehouses by value (highest first)
    const sortedWarehouses = Object.values(warehouseValues).sort((a, b) => b.value - a.value);
    
    sortedWarehouses.forEach(w => {
        const percentage = totalValue > 0 ? ((w.value / totalValue) * 100).toFixed(1) : 0;
        breakdownHTML += `
            <div class="breakdown-item">
                <span class="breakdown-name" title="${w.name}">${w.name}</span>
                <span class="breakdown-value">₹${w.value.toLocaleString()} </span>
            </div>
        `;
    });
    
    breakdownContainer.innerHTML = breakdownHTML;
    
    // Calculate per-warehouse statistics for the pie chart
    const warehouseData = [];
    const labels = [];
    const colors = [
        '#F7C548', // Primary Gold
        '#A98743', // Secondary Bronze
        '#437C90', // Accent Blue
        '#255957', // Dark Teal
        '#e0b038', // Dark Gold
        '#8a6f35', // Dark Bronze
        '#5f9ea0', // Cadet Blue
        '#2e8b57', // Sea Green
    ];
    
    for (const warehouse of warehouses) {
        // Get warehouse items
        const warehouseItems = allItems?.filter(item => item.warehouse_id === warehouse.id) || [];
        
        // Calculate warehouse value
        let warehouseValue = 0;
        warehouseItems.forEach(item => {
            warehouseValue += (item.value || 0) * (item.quantity || 0);
        });
        
        // Get counts
        const { count: racksCount } = await supabaseClient
            .from("racks")
            .select('*', { count: 'exact', head: true })
            .eq('warehouse_id', warehouse.id)
            .eq('organization_id', orgId);
        
        const { count: shelvesCount } = await supabaseClient
            .from("shelves")
            .select('*', { count: 'exact', head: true })
            .eq('warehouse_id', warehouse.id)
            .eq('organization_id', orgId);
        
        const { count: boxesCount } = await supabaseClient
            .from("boxes")
            .select('*', { count: 'exact', head: true })
            .eq('warehouse_id', warehouse.id)
            .eq('organization_id', orgId);
        
        const { count: itemsCount } = await supabaseClient
            .from("items")
            .select('*', { count: 'exact', head: true })
            .eq('warehouse_id', warehouse.id)
            .eq('organization_id', orgId);
        
        // Calculate utilization score (weighted)
        const utilizationScore = (racksCount * 10) + (shelvesCount * 5) + (boxesCount * 2) + itemsCount;
        
        warehouseData.push({
            name: warehouse.name,
            racks: racksCount || 0,
            shelves: shelvesCount || 0,
            boxes: boxesCount || 0,
            items: itemsCount || 0,
            value: warehouseValue,
            score: utilizationScore
        });
        
        labels.push(warehouse.name.length > 15 ? warehouse.name.substring(0, 12) + '...' : warehouse.name);
    }
    
    // Create or update the pie chart
    createPieChart(labels, warehouseData.map(w => w.score), colors, warehouseData);
}

function showEmptyChart() {
    const ctx = document.getElementById('spaceUtilChart')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (window.spaceChart) {
        window.spaceChart.destroy();
    }
    
    // Create a simple chart with "No Data" message
    window.spaceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['No Data'],
            datasets: [{
                data: [1],
                backgroundColor: ['#e0e0e0'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            cutout: '70%'
        }
    });
    
    document.getElementById('spaceUtilLegend').innerHTML = '<div class="legend-item">No warehouses found</div>';
}

function createPieChart(labels, data, colors, warehouseData) {
    const ctx = document.getElementById('spaceUtilChart')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (window.spaceChart) {
        window.spaceChart.destroy();
    }
    
    // Calculate percentages
    const total = data.reduce((a, b) => a + b, 0);
    
    // Create new chart
    window.spaceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, data.length),
                borderColor: 'white',
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            const warehouse = warehouseData[context.dataIndex];
                            return [
                                `${context.label}: ${percentage}%`,
                                `Racks: ${warehouse.racks}`,
                                `Shelves: ${warehouse.shelves}`,
                                `Boxes: ${warehouse.boxes}`,
                                `Items: ${warehouse.items}`,
                                `Value: ₹${warehouse.value.toLocaleString()}`
                            ];
                        }
                    }
                }
            },
            cutout: '60%',
            layout: {
                padding: {
                    bottom: 10
                }
            }
        }
    });
    
    // Create custom legend
    createLegend(warehouseData, colors, data, total);
}

function createLegend(warehouseData, colors, data, total) {
    const legendContainer = document.getElementById('spaceUtilLegend');
    if (!legendContainer) return;
    
    legendContainer.innerHTML = '';
    
    warehouseData.forEach((warehouse, index) => {
        const percentage = total > 0 ? ((data[index] / total) * 100).toFixed(1) : 0;
        
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        
        // Create color circle
        const colorCircle = document.createElement('span');
        colorCircle.className = 'legend-color-circle';
        colorCircle.style.backgroundColor = colors[index % colors.length];
        colorCircle.style.display = 'inline-block';
        colorCircle.style.width = '12px';
        colorCircle.style.height = '12px';
        colorCircle.style.borderRadius = '50%';
        colorCircle.style.marginRight = '8px';
        
        // Create warehouse name span
        const nameSpan = document.createElement('span');
        nameSpan.className = 'legend-label';
        nameSpan.textContent = warehouse.name;
        nameSpan.style.flex = '1';
        
        // Create container for value and percentage
        const statsContainer = document.createElement('span');
        statsContainer.style.display = 'flex';
        statsContainer.style.gap = '10px';
        statsContainer.style.alignItems = 'center';
        
        // Create value span
        const valueSpan = document.createElement('span');
        valueSpan.className = 'legend-value';
        valueSpan.textContent = `₹${(warehouse.value / 1000).toFixed(1)}K`;
        valueSpan.style.fontWeight = '600';
        valueSpan.style.color = 'var(--text-primary)';
        valueSpan.style.fontSize = '0.8rem';
        
        // Create percentage span
        const percentSpan = document.createElement('span');
        percentSpan.className = 'legend-value';
        percentSpan.textContent = `${percentage}%`;
        percentSpan.style.fontWeight = '600';
        percentSpan.style.color = 'var(--accent)';
        percentSpan.style.fontSize = '0.8rem';
        
        statsContainer.appendChild(valueSpan);
        statsContainer.appendChild(percentSpan);
        
        // Assemble legend item
        legendItem.appendChild(colorCircle);
        legendItem.appendChild(nameSpan);
        legendItem.appendChild(statsContainer);
        
        // Add hover effect to highlight chart segment
        legendItem.addEventListener('mouseenter', () => {
            if (window.spaceChart) {
                window.spaceChart.setActiveElements([{ datasetIndex: 0, index: index }]);
                window.spaceChart.update();
            }
            legendItem.style.backgroundColor = 'var(--hover-bg)';
            legendItem.style.borderRadius = '6px';
        });
        
        legendItem.addEventListener('mouseleave', () => {
            if (window.spaceChart) {
                window.spaceChart.setActiveElements([]);
                window.spaceChart.update();
            }
            legendItem.style.backgroundColor = 'transparent';
        });
        
        // Add click handler to highlight corresponding chart segment
        legendItem.addEventListener('click', () => {
            if (window.spaceChart) {
                window.spaceChart.setActiveElements([{ datasetIndex: 0, index: index }]);
                window.spaceChart.update();
            }
        });
        
        legendContainer.appendChild(legendItem);
    });
}


function showEmptyChart() {
    const ctx = document.getElementById('spaceUtilChart')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (window.spaceChart) {
        window.spaceChart.destroy();
    }
    
    // Create a simple chart with "No Data" message
    window.spaceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['No Data'],
            datasets: [{
                data: [1],
                backgroundColor: ['#e0e0e0'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            cutout: '70%'
        }
    });
    
    // Show empty state in legend
    const legendContainer = document.getElementById('spaceUtilLegend');
    if (legendContainer) {
        legendContainer.innerHTML = `
            <div class="legend-item" style="cursor: default; justify-content: center; opacity: 0.6;">
                <span>No warehouses found</span>
            </div>
        `;
    }
}


async function loadRecentItems() {
    const container = document.getElementById("recentItems");
    
    // Check if the element exists
    if (!container) {
        console.log('recentItems element not found in this page - skipping');
        return;
    }
    
    const orgId = sessionStorage.getItem('orgId');
    const { data } = await supabaseClient
        .from("items")
        .select(`
            *,
            warehouses:warehouse_id (name)
        `)
        .eq('organization_id', orgId)
        .order("created_at", { ascending: false })
        .limit(5);

    container.innerHTML = "";

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="no-data">No recent items</p>';
        return;
    }

    data.forEach(item => {
        const div = document.createElement("div");
        div.className = "recent-item";
        div.innerHTML = `
            <div class="recent-item-icon">📄</div>
            <div class="recent-item-info">
                <div class="recent-item-name">${item.name}</div>
                <div class="recent-item-meta">
                    <span>${item.warehouses?.name || 'Unknown'}</span>
                    <span>Qty: ${item.quantity}</span>
                </div>
            </div>
            <div class="recent-item-value">₹${item.value || 0}</div>
        `;
        container.appendChild(div);
    });
}


// In user-management.js, replace the loadActivity function with this:
async function loadActivity() {
    try {
        const orgId = sessionStorage.getItem('orgId') || await getCurrentOrganizationId();
        if (!orgId) {
            console.error('No organization ID for activity log');
            return;
        }

        console.log('Loading activities for orgId:', orgId);

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

        console.log('Loaded activities:', activities?.length || 0);

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
        if (!container) {
            console.error('activityList element not found');
            return;
        }

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
            
            // Format the action text
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

// Helper function to get time ago string


// Helper function for time ago
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

// Helper function for activity icons
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
    } else if (actionLower.includes('test')) {
        return { icon: '🧪', color: '#9b59b6' };
    } else {
        return { icon: '•', color: '#757575' };
    }
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
    } else if (actionLower.includes('login')) {
        return { icon: '🔐', color: '#9b59b6' };
    } else {
        return { icon: '•', color: '#757575' };
    }
}



async function testAddActivity() {
    console.log('Testing activity log...');
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    // Generate a valid UUID format (you can also use null if entity_id is optional)
    const testUuid = '00000000-0000-0000-0000-000000000001';
    
    const { error } = await supabaseClient
        .from("activity_logs")
        .insert([{
            user_id: user.id,
            organization_id: sessionStorage.getItem('orgId'),
            action: 'TEST',
            entity_type: 'system',
            entity_id: testUuid,  // Use a valid UUID format
            description: 'Test activity from system',
            created_by: user.id,
            created_at: new Date().toISOString()
        }]);

    if (error) {
        console.error('Error adding test activity:', error);
    } else {
        console.log('Test activity added successfully');
        // Reload activities
        await loadActivity();
    }
}


// Helper function to log activities
// [REST OF YOUR EXISTING TREE AND SEARCH CODE REMAINS EXACTLY THE SAME]
// ... (keep all your existing tree and search functions)




// Helper function to log activities
// Helper function to log activities
async function logActivity(action, entityType, entityId, description) {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            console.error('No user logged in for activity log');
            return;
        }

        const orgId = sessionStorage.getItem('orgId') || await getCurrentOrganizationId();
        if (!orgId) {
            console.error('No organization ID for activity log');
            return;
        }

        // Ensure entityId is either a valid UUID or null
        const validEntityId = entityId && entityId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) 
            ? entityId 
            : null;

        const { error } = await supabaseClient
            .from("activity_logs")
            .insert([{
                user_id: user.id,
                organization_id: orgId,
                action: action,
                entity_type: entityType,
                entity_id: validEntityId,  // Use null if not a valid UUID
                description: description,
                created_by: user.id,
                created_at: new Date().toISOString()
            }]);

        if (error) {
            console.error('Error logging activity:', error);
        } else {
            console.log('Activity logged:', action, description);
        }
    } catch (err) {
        console.error('Exception in logActivity:', err);
    }
}

function createTreeNode(icon, label, type, id) {
    const node = document.createElement("div");
    node.className = "tree-node";

    const header = document.createElement("div");
    header.className = "tree-header";

    // Map icon types to image paths
    const iconMap = {
        "🏢": "./src/warehouse.png",
        "🗄": "./src/rack.png",
        "📚": "./src/shelf.png",
        "📦": "./src/box.png"
    };

    const iconPath = iconMap[icon] || "./src/paper-clip.png";
    
    header.innerHTML = `
        <span class="tree-arrow"><img class ="inventory-exp-arrow" src="./src/arrow.png"></span>
        <span class="tree-icon">
            <img src="${iconPath}" alt="${type}" class="tree-icon-img">
        </span>
        <span class="tree-label">${label}</span>
    `;

    header.dataset.type = type;
    header.dataset.id = id;

    const children = document.createElement("div");
    children.className = "tree-children";

    // Use a flag to prevent multiple simultaneous loads
    let isLoading = false;
    
    header.onclick = async () => {
        // Don't do anything if we're in search mode
        if (searchMode) return;
        
        header.classList.toggle("open");
        children.classList.toggle("open");

        // Lazy load children only once
        if (!children.dataset.loaded && !isLoading) {
            isLoading = true;
            await loadChildren(children, type, id);
            children.dataset.loaded = "true";
            isLoading = false;
        }
    };

    node.appendChild(header);
    node.appendChild(children);

    return node;
}


async function loadChildren(container, type, id) {
    container.innerHTML = "";
    const orgId = sessionStorage.getItem('orgId');

    if (type === "warehouse") {
        const { data } = await supabaseClient
            .from("racks")
            .select("*")
            .eq("warehouse_id", id)
            .eq('organization_id', orgId);

        data.forEach(r => {
            container.appendChild(createTreeNode("🗄", r.name, "rack", r.id));
        });
    }

    if (type === "rack") {
        const { data } = await supabaseClient
            .from("shelves")
            .select("*")
            .eq("rack_id", id)
            .eq('organization_id', orgId);

        data.forEach(s => {
            container.appendChild(createTreeNode("📚", s.name, "shelf", s.id));
        });
    }

    if (type === "shelf") {
        const { data: boxes } = await supabaseClient
            .from("boxes")
            .select("*")
            .eq("shelf_id", id)
            .eq('organization_id', orgId);

        boxes.forEach(b => {
            container.appendChild(createTreeNode("📦", b.name, "box", b.id));
        });

        const { data: items } = await supabaseClient
            .from("items")
            .select("*")
            .eq("shelf_id", id)
            .is("box_id", null)
            .eq('organization_id', orgId);

        items.forEach(i => {
            container.appendChild(createLeafNode("📄", i.name));
        });
    }

    if (type === "box") {
        const { data } = await supabaseClient
            .from("items")
            .select("*")
            .eq("box_id", id)
            .eq('organization_id', orgId);

        data.forEach(i => {
            container.appendChild(createLeafNode("📄", i.name));
        });
    }
}



// this function reset the tree when needed
async function resetTree() {
  // Clear all loaded flags
  document.querySelectorAll(".tree-children").forEach(children => {
    children.dataset.loaded = "";
    children.innerHTML = "";
    children.classList.remove("open");
  });
  
  // Reload the tree from scratch
  await loadInventoryTree();
}






function createLeafNode(icon, label) {
    const leaf = document.createElement("div");
    leaf.className = "tree-leaf";
    
    // Use item icon for leaf nodes
    leaf.innerHTML = `
        <span class="tree-icon">
            <img src="./src/paper-clip.png" alt="item" class="tree-icon-img">
        </span>
        <span>${label}</span>
    `;
    return leaf;
}




//Search


let searchTimeout = null;
let lastSearchValue = '';

document.getElementById("searchBar").addEventListener("input", function () {
  const value = this.value.toLowerCase().trim();
  
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  // Debounce search to prevent multiple rapid executions
  searchTimeout = setTimeout(() => {
    searchTree(value);
  }, 300);
});

async function searchTree(value) {
  // Prevent searching the same value multiple times
  if (value === lastSearchValue) {
    return;
  }
  lastSearchValue = value;
  
  value = value.trim().toLowerCase();

  const allHeaders = document.querySelectorAll(".tree-header, .tree-leaf");

  // Reset highlight
  allHeaders.forEach(el => el.classList.remove("search-match"));

  if (!value) {
    searchMode = false;
    lastSearchValue = '';

    // Restore tree to normal state
    document.querySelectorAll(".tree-node")
      .forEach(n => n.style.display = "block");

    // Close all children but keep them loaded
    document.querySelectorAll(".tree-children")
      .forEach(c => c.classList.remove("open"));

    return;
  }

  searchMode = true;

  // 🔥 FIRST: Expand the entire tree to load all data (but don't load twice)
  await expandEntireTree();

  // THEN: Hide all nodes
  document.querySelectorAll(".tree-node").forEach(node => {
    node.style.display = "none";
  });

  // Get all headers and leaves that match
  const matches = [];
  allHeaders.forEach(el => {
    if (el.innerText.toLowerCase().includes(value)) {
      matches.push(el);
    }
  });

  // For each match, show its path
  for (let el of matches) {
    el.classList.add("search-match");
    
    let parent = el.closest(".tree-node");
    const pathToShow = [];
    
    // Build the path from root to this node
    while (parent) {
      pathToShow.unshift(parent);
      parent = parent.parentElement.closest(".tree-node");
    }
    
    // Show each node in the path - DON'T load children again, just show them
    for (let node of pathToShow) {
      node.style.display = "block";
      
      // Make sure children are open (they're already loaded by expandEntireTree)
      const children = node.querySelector(".tree-children");
      if (children) {
        children.classList.add("open");
      }
    }
  }
}


async function expandEntireTree() {
    const headers = document.querySelectorAll(".tree-header");
    const orgId = sessionStorage.getItem('orgId');
    
    for (let header of headers) {
        const node = header.parentElement;
        const children = node.querySelector(".tree-children");
        
        if (!children) continue;
        
        // Only load if not already loaded
        if (!children.dataset.loaded) {
            const type = header.dataset.type;
            const id = header.dataset.id;
            
            if (type && id) {
                // Clear and load with orgId filter
                children.innerHTML = '';
                await loadChildren(children, type, id);
                children.dataset.loaded = "true";
            }
        }
        
        // Always open but don't reload
        children.classList.add("open");
    }
}










