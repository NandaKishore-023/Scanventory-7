// js/qrGenerator.js

function getBaseUrl() {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
        return 'http://localhost:5500';
    } else {
        return 'https://nandakishore-023.github.io/Scanventory-7';
    }
}

async function generateQRCode(entityType, entityId, entityName) {
    try {
        const baseUrl = getBaseUrl();
        const orgId = sessionStorage.getItem('orgId');
        
        // Create the URL for this entity - make sure it includes the full path
        const entityUrl = `${baseUrl}/view-entity.html?type=${entityType}&id=${entityId}&org=${orgId}`;
        
        console.log("Generated QR URL:", entityUrl); // For debugging
        
        // Generate QR code using a library
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(entityUrl)}`;
        
        // Return the QR code image URL
        return qrCodeUrl;
    } catch (error) {
        console.error('Error generating QR code:', error);
        return null;
    }
}

async function saveQRCodeToEntity(entityType, entityId, qrCode) {
    try {
        const { error } = await supabaseClient
            .from(entityType)
            .update({ qr_code: qrCode })
            .eq('id', entityId);
            
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error saving QR code:', error);
        return false;
    }
}

// Add QR code generation button to entity forms
async function generateAndSaveQR(entityType, entityId, entityName) {
    const qrCodeUrl = await generateQRCode(entityType, entityId, entityName);
    if (qrCodeUrl) {
        await saveQRCodeToEntity(entityType, entityId, qrCodeUrl);
        return qrCodeUrl;
    }
    return null;
}