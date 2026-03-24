// js/view-entity.js
let currentEntity = null;
let entityType = null;
let entityId = null;


// Add this at the very beginning of view-entity.js
(function() {
    // Check if we're on GitHub Pages and the URL doesn't include the repo name
    if (window.location.hostname.includes('github.io') && 
        !window.location.pathname.includes('/Scanventory-7/') &&
        window.location.pathname === '/view-entity.html') {
        
        // Redirect to the correct URL with repo name
        const newUrl = 'https://nandakishore-023.github.io/Scanventory-7' + window.location.pathname + window.location.search;
        window.location.replace(newUrl);
    }
})();


window.onload = async () => {
    console.log("View entity page loaded");
    
    await protectPage();
    await loadUser();
    
    // Get parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    entityType = urlParams.get('type');
    entityId = urlParams.get('id');
    const orgId = urlParams.get('org'); // Get organization ID from URL
    
    console.log("URL Parameters:", { entityType, entityId, orgId });
    
    // If orgId is provided in URL, store it in session
    if (orgId) {
        sessionStorage.setItem('orgId', orgId);
    }
    
    if (!entityType || !entityId) {
        console.error("Missing entity type or ID");
        showError('Invalid QR code. No entity specified.');
        return;
    }
    
    await loadEntity();
    await loadActivity();
};

async function loadEntity() {
    try {
        console.log(`Loading ${entityType} with ID: ${entityId}`);
        
        // First, verify the table exists and we have access
        const { data: tables, error: tablesError } = await supabaseClient
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_name', entityType)
            .maybeSingle();
            
        if (tablesError) {
            console.error("Error checking table:", tablesError);
        }
        
        const { data, error } = await supabaseClient
            .from(entityType)
            .select('*')
            .eq('id', entityId)
            .single();
            
        if (error) {
            console.error("Supabase error:", error);
            throw error;
        }
        
        console.log("Entity data loaded:", data);
        
        if (!data) {
            showError('Entity not found.');
            return;
        }
        
        currentEntity = data;
        displayEntity();
        
        // Check if QRCode library is available
        if (typeof QRCode !== 'undefined') {
            generateQRCode();
        } else {
            console.error("QRCode library not loaded");
            document.getElementById('qrcode').innerHTML = '<p>QR library not loaded</p>';
        }
        
        loadChildren();
    } catch (error) {
        console.error('Error loading entity:', error);
        showError('Entity not found or access denied. Error: ' + error.message);
    }
}

function displayEntity() {
    console.log("Displaying entity:", currentEntity);
    
    // Check if all elements exist
    const elements = {
        title: document.getElementById('entityTitle'),
        name: document.getElementById('entityName'),
        type: document.getElementById('entityType'),
        id: document.getElementById('entityId'),
        created: document.getElementById('entityCreated'),
        updated: document.getElementById('entityUpdated'),
        icon: document.getElementById('entityIcon')
    };
    
    // Log missing elements
    for (let [key, element] of Object.entries(elements)) {
        if (!element) console.error(`Element #${key} not found`);
    }
    
    if (elements.title) {
        elements.title.innerText = 
            `${capitalizeFirst(entityType)}: ${currentEntity.name || 'Unnamed'}`;
    }
    
    if (elements.name) elements.name.innerText = currentEntity.name || 'Unnamed';
    if (elements.type) elements.type.innerText = capitalizeFirst(entityType);
    if (elements.id) elements.id.innerText = currentEntity.id;
    
    if (elements.created) {
        elements.created.innerText = currentEntity.created_at 
            ? new Date(currentEntity.created_at).toLocaleDateString() 
            : 'Unknown';
    }
    
    if (elements.updated) {
        elements.updated.innerText = currentEntity.updated_at 
            ? new Date(currentEntity.updated_at).toLocaleDateString() 
            : 'Never';
    }
    
    // Set icon based on entity type
    const icons = {
        warehouses: '🏢',
        racks: '🗄️',
        shelves: '📚',
        boxes: '📦',
        items: '📄'
    };
    
    if (elements.icon) {
        elements.icon.innerText = icons[entityType] || '📦';
    }
    
    // Display entity-specific details
    displaySpecificDetails();
    
    // Load location path
    loadLocationPath();
}

async function displaySpecificDetails() {
    const container = document.getElementById('entitySpecificDetails');
    if (!container) {
        console.error("entitySpecificDetails element not found");
        return;
    }
    
    let html = '<div class="specific-details">';
    
    switch(entityType) {
        case 'items':
            html += `
                <div class="detail-row">
                    <span class="detail-label">Quantity:</span>
                    <span class="detail-value">${currentEntity.quantity || 0}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Value:</span>
                    <span class="detail-value">₹${currentEntity.value || 0}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${currentEntity.description || 'No description'}</span>
                </div>
            `;
            break;
            
        case 'boxes':
        case 'shelves':
            html += `
                <div class="detail-row">
                    <span class="detail-label">Capacity:</span>
                    <span class="detail-value">${currentEntity.capacity || 'Not set'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${currentEntity.description || 'No description'}</span>
                </div>
            `;
            break;
            
        default:
            html += `
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${currentEntity.description || 'No description'}</span>
                </div>
            `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

async function loadLocationPath() {
    const container = document.getElementById('locationPath');
    if (!container) return;
    
    if (entityType === 'warehouses') {
        container.innerHTML = `<span class="path-item">${currentEntity.name}</span>`;
        return;
    }
    
    let path = [];
    let currentId = entityId;
    let currentType = entityType;
    
    try {
        while (currentType !== 'warehouses' && currentId) {
            console.log(`Loading parent for ${currentType} with ID: ${currentId}`);
            
            const { data, error } = await supabaseClient
                .from(currentType)
                .select('name, warehouse_id, rack_id, shelf_id, box_id')
                .eq('id', currentId)
                .single();
                
            if (error) {
                console.error(`Error loading parent ${currentType}:`, error);
                break;
            }
            
            if (data) {
                path.unshift({ type: currentType, name: data.name, id: currentId });
                
                // Move up the hierarchy
                if (data.warehouse_id) {
                    currentId = data.warehouse_id;
                    currentType = 'warehouses';
                } else if (data.rack_id) {
                    currentId = data.rack_id;
                    currentType = 'racks';
                } else if (data.shelf_id) {
                    currentId = data.shelf_id;
                    currentType = 'shelves';
                } else if (data.box_id) {
                    currentId = data.box_id;
                    currentType = 'boxes';
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    } catch (err) {
        console.error("Error loading location path:", err);
    }
    
    // Build HTML path
    let pathHtml = '';
    for (let item of path) {
        pathHtml += `<span class="path-separator">›</span>`;
        pathHtml += `<span class="path-item" onclick="navigateToEntity('${item.type}', '${item.id}')">${item.name}</span>`;
    }
    
    container.innerHTML = pathHtml;
}

function navigateToEntity(type, id) {
    window.location.href = `view-entity.html?type=${type}&id=${id}`;
}

async function loadChildren() {
    const container = document.getElementById('childrenSection');
    const listContainer = document.getElementById('childrenList');
    
    if (!container || !listContainer) {
        console.error("Children section elements not found");
        return;
    }
    
    let children = [];
    let childType = '';
    
    try {
        switch(entityType) {
            case 'warehouses':
                childType = 'racks';
                const { data: racks } = await supabaseClient
                    .from('racks')
                    .select('*')
                    .eq('warehouse_id', entityId);
                children = racks || [];
                break;
                
            case 'racks':
                childType = 'shelves';
                const { data: shelves } = await supabaseClient
                    .from('shelves')
                    .select('*')
                    .eq('rack_id', entityId);
                children = shelves || [];
                break;
                
            case 'shelves':
                childType = 'boxes';
                const { data: boxes } = await supabaseClient
                    .from('boxes')
                    .select('*')
                    .eq('shelf_id', entityId);
                children = boxes || [];
                break;
                
            case 'boxes':
                childType = 'items';
                const { data: items } = await supabaseClient
                    .from('items')
                    .select('*')
                    .eq('box_id', entityId);
                children = items || [];
                break;
                
            default:
                container.style.display = 'none';
                return;
        }
    } catch (err) {
        console.error("Error loading children:", err);
        listContainer.innerHTML = '<p class="no-data">Error loading contents</p>';
        return;
    }
    
    console.log(`Loaded ${children.length} children of type ${childType}`);
    
    if (children.length === 0) {
        listContainer.innerHTML = '<p class="no-data">No items found</p>';
        return;
    }
    
    listContainer.innerHTML = '';
    children.forEach(child => {
        const childCard = document.createElement('div');
        childCard.className = 'child-card';
        childCard.onclick = () => {
            window.location.href = `view-entity.html?type=${childType}&id=${child.id}`;
        };
        childCard.innerHTML = `
            <div class="child-icon">${getIconForType(childType)}</div>
            <div class="child-name">${child.name}</div>
            <div class="child-details">${getChildDetails(child, childType)}</div>
        `;
        listContainer.appendChild(childCard);
    });
}

function getChildType(parentType) {
    const types = {
        warehouses: 'racks',
        racks: 'shelves',
        shelves: 'boxes',
        boxes: 'items'
    };
    return types[parentType] || parentType;
}

function getIconForType(type) {
    const icons = {
        racks: '🗄️',
        shelves: '📚',
        boxes: '📦',
        items: '📄'
    };
    return icons[type] || '📦';
}

function getChildDetails(child, type) {
    switch(type) {
        case 'items':
            return `Qty: ${child.quantity} | Value: ₹${child.value || 0}`;
        case 'boxes':
        case 'shelves':
            return child.capacity ? `Capacity: ${child.capacity}` : '';
        default:
            return '';
    }
}

function generateQRCode() {
    const baseUrl = getBaseUrl(); // Use the function instead of window.location.origin
    const entityUrl = `${baseUrl}/view-entity.html?type=${entityType}&id=${entityId}`;
    
    console.log("Generating QR for URL:", entityUrl);
    
    // Clear previous QR code
    const qrContainer = document.getElementById('qrcode');
    if (!qrContainer) {
        console.error("QR code container not found");
        return;
    }
    
    qrContainer.innerHTML = '';
    
    // Generate new QR code
    try {
        new QRCode(qrContainer, {
            text: entityUrl,
            width: 200,
            height: 200
        });
        console.log("QR code generated successfully");
    } catch (err) {
        console.error("Error generating QR code:", err);
        qrContainer.innerHTML = '<p>Error generating QR code</p>';
    }
}

function downloadQR() {
    const canvas = document.querySelector('#qrcode canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = `${entityType}_${currentEntity.name}_qr.png`;
        link.href = canvas.toDataURL();
        link.click();
    }
}

function printQR() {
    const canvas = document.querySelector('#qrcode canvas');
    if (canvas) {
        const win = window.open('');
        win.document.write(`
            <html>
                <head><title>Print QR Code</title></head>
                <body style="text-align: center; padding: 50px;">
                    <h2>${currentEntity.name}</h2>
                    <p>${capitalizeFirst(entityType)}</p>
                    <img src="${canvas.toDataURL()}" style="width: 300px; height: 300px;">
                </body>
            </html>
        `);
        win.print();
    }
}

function showMoveForm() {
    document.getElementById('moveForm').style.display = 'block';
    loadMoveWarehouses();
}

function hideMoveForm() {
    document.getElementById('moveForm').style.display = 'none';
}

async function loadMoveWarehouses() {
    try {
        const orgId = sessionStorage.getItem('orgId');
        const { data, error } = await supabaseClient
            .from('warehouses')
            .select('id, name')
            .eq('organization_id', orgId);
            
        if (error) throw error;
        
        const select = document.getElementById('moveWarehouse');
        select.innerHTML = '<option value="">Select Warehouse</option>';
        data.forEach(w => {
            select.innerHTML += `<option value="${w.id}">${w.name}</option>`;
        });
    } catch (err) {
        console.error("Error loading warehouses:", err);
    }
}

async function loadMoveRacks() {
    const warehouseId = document.getElementById('moveWarehouse').value;
    if (!warehouseId) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('racks')
            .select('id, name')
            .eq('warehouse_id', warehouseId);
            
        if (error) throw error;
        
        const select = document.getElementById('moveRack');
        select.innerHTML = '<option value="">Select Rack</option>';
        data.forEach(r => {
            select.innerHTML += `<option value="${r.id}">${r.name}</option>`;
        });
    } catch (err) {
        console.error("Error loading racks:", err);
    }
}

async function loadMoveShelves() {
    const rackId = document.getElementById('moveRack').value;
    if (!rackId) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('shelves')
            .select('id, name')
            .eq('rack_id', rackId);
            
        if (error) throw error;
        
        const select = document.getElementById('moveShelf');
        select.innerHTML = '<option value="">Select Shelf</option>';
        data.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    } catch (err) {
        console.error("Error loading shelves:", err);
    }
}

async function loadMoveBoxes() {
    const shelfId = document.getElementById('moveShelf').value;
    if (!shelfId) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('boxes')
            .select('id, name')
            .eq('shelf_id', shelfId);
            
        if (error) throw error;
        
        const select = document.getElementById('moveBox');
        select.innerHTML = '<option value="">(Optional) Select Box</option>';
        data.forEach(b => {
            select.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        });
    } catch (err) {
        console.error("Error loading boxes:", err);
    }
}

async function moveEntity() {
    const toWarehouse = document.getElementById('moveWarehouse').value;
    const toRack = document.getElementById('moveRack').value;
    const toShelf = document.getElementById('moveShelf').value;
    const toBox = document.getElementById('moveBox').value || null;
    const quantity = document.getElementById('moveQuantity').value;
    
    if (!toWarehouse || !toRack || !toShelf) {
        alert('Please select destination');
        return;
    }
    
    if (entityType === 'items' && (!quantity || quantity <= 0)) {
        alert('Please enter valid quantity');
        return;
    }
    
    try {
        if (entityType === 'items') {
            await moveItem(entityId, quantity, toWarehouse, toRack, toShelf, toBox);
        } else {
            await moveContainer(entityType, entityId, toWarehouse, toRack, toShelf, toBox);
        }
        
        alert('Item moved successfully!');
        hideMoveForm();
        loadEntity(); // Reload to show new location
    } catch (error) {
        alert('Error moving item: ' + error.message);
    }
}

async function moveItem(itemId, quantity, toWarehouse, toRack, toShelf, toBox) {
    const { data: item, error: itemError } = await supabaseClient
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();
        
    if (itemError) throw itemError;
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    const orgId = sessionStorage.getItem('orgId');
    
    if (quantity == item.quantity) {
        // Move all
        const { error: updateError } = await supabaseClient
            .from('items')
            .update({
                warehouse_id: toWarehouse,
                rack_id: toRack,
                shelf_id: toShelf,
                box_id: toBox
            })
            .eq('id', itemId);
            
        if (updateError) throw updateError;
    } else {
        // Move part
        const newQuantity = item.quantity - quantity;
        
        const { error: updateError } = await supabaseClient
            .from('items')
            .update({ quantity: newQuantity })
            .eq('id', itemId);
            
        if (updateError) throw updateError;
            
        const { error: insertError } = await supabaseClient
            .from('items')
            .insert([{
                name: item.name,
                quantity: quantity,
                value: item.value,
                description: item.description,
                warehouse_id: toWarehouse,
                rack_id: toRack,
                shelf_id: toShelf,
                box_id: toBox,
                organization_id: orgId,
                created_by: user.id
            }]);
            
        if (insertError) throw insertError;
    }
    
    await logActivity('MOVE', 'items', itemId, `Moved ${quantity} of ${item.name}`);
}

async function moveContainer(type, id, toWarehouse, toRack, toShelf, toBox) {
    const updateData = {
        warehouse_id: toWarehouse,
        rack_id: toRack,
        shelf_id: toShelf
    };
    
    if (toBox) updateData.box_id = toBox;
    
    const { error } = await supabaseClient
        .from(type)
        .update(updateData)
        .eq('id', id);
        
    if (error) throw error;
        
    await logActivity('MOVE', type, id, `Moved ${type} to new location`);
}

async function editEntity() {
    window.location.href = `inventory.html?tab=${entityType}&edit=${entityId}`;
}

async function deleteEntity() {
    if (!confirm(`Are you sure you want to delete this ${entityType.slice(0, -1)}?`)) return;
    
    try {
        const { error } = await supabaseClient
            .from(entityType)
            .delete()
            .eq('id', entityId);
            
        if (error) throw error;
            
        await logActivity('DELETE', entityType, entityId, `Deleted ${entityType} ${currentEntity.name}`);
        
        alert('Deleted successfully!');
        window.location.href = 'index.html';
    } catch (error) {
        alert('Error deleting: ' + error.message);
    }
}

function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).replace(/_/g, ' ');
}

function showError(message) {
    const titleEl = document.getElementById('entityTitle');
    const nameEl = document.getElementById('entityName');
    
    if (titleEl) titleEl.innerText = 'Error';
    if (nameEl) nameEl.innerText = message;
}

// Make functions globally available
window.loadMoveRacks = loadMoveRacks;
window.loadMoveShelves = loadMoveShelves;
window.loadMoveBoxes = loadMoveBoxes;
window.showMoveForm = showMoveForm;
window.hideMoveForm = hideMoveForm;
window.moveEntity = moveEntity;
window.editEntity = editEntity;
window.deleteEntity = deleteEntity;
window.downloadQR = downloadQR;
window.printQR = printQR;
window.navigateToEntity = navigateToEntity;