
        // Global State Variables
        let parsedHarData = null;
        let activeFilterMime = 'all';
        let currentFileRef = null;
        let selectedRowIndex = null;
        let activeCodeFileId = 'app-py';
        let currentlySelectedRequest = null; // Store request state for explanation
        let aiReportTextCache = ""; // Holds active AI report on screen for clipboard operations
        let responsePayloadCache = ""; // Cached response payload value for quick copies

        // Flow Tab Latency Thresholds Configuration
        let flowGreenLimit = 200; // in milliseconds
        let flowRedLimit = 800; // in milliseconds

        // Drop Zone Event Listeners
        const dropZone = document.getElementById('drop-zone');

        if (dropZone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    dropZone.classList.add('border-indigo-500', 'bg-slate-800/60');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    dropZone.classList.remove('border-indigo-500', 'bg-slate-800/60');
                }, false);
            });

            dropZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length > 0) {
                    processUploadedFile(files[0]);
                }
            });

            dropZone.addEventListener('click', () => {
                document.getElementById('file-input').click();
            });
        }

        function handleFileSelect(e) {
            const files = e.target.files;
            if (files.length > 0) {
                processUploadedFile(files[0]);
            }
        }

        // File Handler
        function processUploadedFile(file) {
            currentFileRef = file;
            document.getElementById('active-filename').innerText = file.name;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const harJson = JSON.parse(event.target.result);
                    validateAndLoadHAR(harJson, file.name);
                } catch (err) {
                    showNotification("Failed to parse JSON schema. Verify target is a valid .har file.", "error");
                }
            };
            reader.readAsText(file);
        }

        // Core Loader & Validator
        function validateAndLoadHAR(harData, filename) {
            if (!harData.log || !harData.log.entries) {
                showNotification("Invalid W3C HAR Format. Root 'log' or 'entries' array missing.", "error");
                return;
            }

            parsedHarData = harData;

            // Generate unique hostname/origins dropdown mapping
            populateOriginsDropdown();

            // Perform statistical metric evaluation
            calculateSessionMetrics();

            // Hide Initial Box
            document.getElementById('initial-state-indicator').classList.add('hidden');
            document.getElementById('waterfall-canvas-container').classList.remove('hidden');

            // Apply Filters & Render Waterfall rows / Flow pathway
            applyFilters();
            
            // Perform Pre-Consent GDPR audits
            auditConsentViolations();

            // Reset dynamic finder elements
            clearLocatorMatches();

            showNotification(`Successfully parsed "${filename}" with ${harData.log.entries.length} requests.`, "success");
        }

        // Calculations & Metrics Engine
        function calculateSessionMetrics() {
            const entries = parsedHarData.log.entries;
            const totalReqs = entries.length;
            
            let totalBytes = 0;
            let success = 0;
            let redirects = 0;
            let clientErrs = 0;
            let serverErrs = 0;
            let thirdParty = 0;

            entries.forEach(entry => {
                // Byte calculation mapping sizes
                const res = entry.response;
                const bodySize = res.bodySize || 0;
                const headSize = res.headersSize || 0;
                totalBytes += (bodySize > 0 ? bodySize : 0) + (headSize > 0 ? headSize : 0);

                // HTTP status groupings
                const status = res.status;
                if (status >= 200 && status < 300) success++;
                else if (status >= 300 && status < 400) redirects++;
                else if (status >= 400 && status < 500) clientErrs++;
                else if (status >= 500) serverErrs++;

                // Trackers count helper
                const url = entry.request.url;
                if (isThirdPartyTracker(url)) {
                    thirdParty++;
                }
            });

            // Try rendering load time from page property
            let loadTime = 0;
            if (parsedHarData.log.pages && parsedHarData.log.pages.length > 0) {
                const page = parsedHarData.log.pages[0];
                // Use page timings load parameter if it exists
                if (page.pageTimings && page.pageTimings.onLoad) {
                    loadTime = Math.round(page.pageTimings.onLoad);
                }
            }
            if (loadTime === 0 && entries.length > 0) {
                // Fallback: estimate page load duration from relative difference between first and last entry
                const start = new Date(entries[0].startedDateTime).getTime();
                const lastEntry = entries[entries.length - 1];
                const lastTime = new Date(lastEntry.startedDateTime).getTime() + (lastEntry.time || 0);
                loadTime = Math.max(0, Math.round(lastTime - start));
            }

            // Bind values to UI elements
            document.getElementById('stat-total-reqs').innerText = totalReqs;
            document.getElementById('stat-total-size').innerText = `${Math.round(totalBytes / 1024).toLocaleString()} KB`;
            document.getElementById('stat-load-time').innerText = `${loadTime.toLocaleString()} ms`;
            document.getElementById('stat-third-party').innerText = thirdParty;

            document.getElementById('stat-success-count').innerText = success;
            document.getElementById('stat-redirect-count').innerText = redirects;
            document.getElementById('stat-client-err-count').innerText = clientErrs;
            document.getElementById('stat-server-err-count').innerText = serverErrs;
        }

        // Helper to evaluate typical standard analytics hostnames
        function isThirdPartyTracker(url) {
            const lowercaseUrl = url.toLowerCase();
            const trackerPatterns = [
                'google-analytics', 'analytics', 'facebook.net', 'fbcdn', 'doubleclick', 'hotjar',
                'optimizely', 'amplitude', 'mixpanel', 'segment', 'datadog', 'intercom'
            ];
            return trackerPatterns.some(pattern => lowercaseUrl.includes(pattern));
        }

        // Dropdown dynamic parsing
        function populateOriginsDropdown() {
            const hostSelect = document.getElementById('filter-host');
            hostSelect.innerHTML = '<option value="ALL">All Hostnames</option>';
            
            if (!parsedHarData) return;

            const hosts = new Set();
            parsedHarData.log.entries.forEach(entry => {
                try {
                    const parsedUrl = new URL(entry.request.url);
                    hosts.add(parsedUrl.hostname);
                } catch (e) {
                    // Fallback block if invalid absolute URL configuration
                }
            });

            hosts.forEach(host => {
                const option = document.createElement('option');
                option.value = host;
                option.innerText = host;
                hostSelect.appendChild(option);
            });
        }

        // Dynamic Call Finder
        function locateCallsFromInput() {
            const locatorInput = document.getElementById('locator-input');
            const targetKeyword = locatorInput.value.trim().toLowerCase();

            if (!parsedHarData) {
                showNotification("No HAR data loaded. Upload a file or load Demo session first.", "error");
                return;
            }

            if (!targetKeyword) {
                clearLocatorMatches();
                return;
            }

            const matchedEntries = [];
            parsedHarData.log.entries.forEach((entry, originalIndex) => {
                const url = entry.request.url.toLowerCase();
                const method = entry.request.method.toLowerCase();
                const statusStr = String(entry.response.status);
                
                // Content Type check
                let mime = '';
                if (entry.response && entry.response.content && entry.response.content.mimeType) {
                    mime = entry.response.content.mimeType.toLowerCase();
                }

                // Check multiple fields for keyword presence
                if (url.includes(targetKeyword) || 
                    method.includes(targetKeyword) || 
                    statusStr.includes(targetKeyword) || 
                    mime.includes(targetKeyword)) {
                    matchedEntries.push({ entry, originalIndex });
                }
            });

            // Update locator badges and wrapper visibility
            const badge = document.getElementById('locator-badge');
            const resultsWrapper = document.getElementById('locator-results-wrapper');
            const resultsContainer = document.getElementById('locator-results');

            badge.innerText = `${matchedEntries.length} found`;
            badge.classList.remove('hidden');
            resultsWrapper.classList.remove('hidden');
            resultsContainer.innerHTML = '';

            if (matchedEntries.length === 0) {
                resultsContainer.innerHTML = `<p class="text-[11px] text-slate-500 py-3 text-center">No exact network calls match "${locatorInput.value}"</p>`;
                return;
            }

            // Sync search value to the main filtering field and execute
            document.getElementById('filter-search').value = locatorInput.value;
            switchTab('waterfall'); // Auto-switch to Waterfall timeline tab
            applyFilters();

            // Populate the interactive mini sidebar results list
            matchedEntries.forEach(item => {
                const e = item.entry;
                const pathName = e.request.url.split('/').pop() || e.request.url;
                const sizeBytes = e.response.bodySize > 0 ? e.response.bodySize : 0;
                const sizeText = sizeBytes > 0 ? `${(sizeBytes / 1024).toFixed(1)}K` : '0B';
                
                let statusColor = "text-emerald-400 bg-emerald-500/10";
                if (e.response.status >= 400) statusColor = "text-rose-400 bg-rose-500/10";
                else if (e.response.status >= 300) statusColor = "text-blue-400 bg-blue-500/10";

                const buttonEl = document.createElement('button');
                buttonEl.className = "w-full text-left bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700/80 rounded-lg p-2 flex flex-col justify-between space-y-1 transition-all duration-150 group";
                buttonEl.onclick = () => {
                    // Highlight on timeline and open side details panel directly
                    openDetails(e, item.originalIndex);
                };

                buttonEl.innerHTML = `
                    <div class="flex items-center justify-between w-full">
                        <span class="text-[10px] font-mono font-bold uppercase text-indigo-400 group-hover:text-indigo-300">${e.request.method}</span>
                        <span class="font-mono text-[9px] px-1 py-0.2 rounded font-bold ${statusColor}">${e.response.status || 'Cancelled'}</span>
                    </div>
                    <div class="text-[11px] font-mono text-slate-300 group-hover:text-white truncate w-full" title="${e.request.url}">
                        ${pathName}
                    </div>
                    <div class="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                        <span class="truncate max-w-[120px]">${new URL(e.request.url).hostname}</span>
                        <span>${sizeText}</span>
                    </div>
                `;
                resultsContainer.appendChild(buttonEl);
            });
        }

        function clearLocatorMatches() {
            document.getElementById('locator-input').value = '';
            document.getElementById('locator-badge').classList.add('hidden');
            document.getElementById('locator-results-wrapper').classList.add('hidden');
            document.getElementById('locator-results').innerHTML = '';
            document.getElementById('filter-search').value = '';
            applyFilters();
        }

        // Multi-dimensional Filter Engine
        function applyFilters() {
            if (!parsedHarData) return;

            const searchQuery = document.getElementById('filter-search').value.toLowerCase();
            const selectedMethod = document.getElementById('filter-method').value;
            const selectedHost = document.getElementById('filter-host').value;

            const filteredEntries = parsedHarData.log.entries.filter(entry => {
                const url = entry.request.url.toLowerCase();
                const method = entry.request.method;
                const duration = Math.round(entry.time || 0);
                let mime = '';
                
                if (entry.response && entry.response.content && entry.response.content.mimeType) {
                    mime = entry.response.content.mimeType.toLowerCase();
                }

                // 1. Text Search Filter — URL, headers, cookies, request/response body
                if (searchQuery) {
                    let matched = url.includes(searchQuery);

                    if (!matched) {
                        // Request headers
                        matched = (entry.request.headers || []).some(h =>
                            h.name.toLowerCase().includes(searchQuery) ||
                            h.value.toLowerCase().includes(searchQuery)
                        );
                    }
                    if (!matched) {
                        // Response headers
                        matched = (entry.response.headers || []).some(h =>
                            h.name.toLowerCase().includes(searchQuery) ||
                            h.value.toLowerCase().includes(searchQuery)
                        );
                    }
                    if (!matched) {
                        // Request cookies
                        matched = (entry.request.cookies || []).some(c =>
                            c.name.toLowerCase().includes(searchQuery) ||
                            (c.value || '').toLowerCase().includes(searchQuery)
                        );
                    }
                    if (!matched) {
                        // Response cookies
                        matched = (entry.response.cookies || []).some(c =>
                            c.name.toLowerCase().includes(searchQuery) ||
                            (c.value || '').toLowerCase().includes(searchQuery)
                        );
                    }
                    if (!matched) {
                        // Request POST body text
                        const postText = entry.request.postData?.text || '';
                        matched = postText.toLowerCase().includes(searchQuery);
                    }
                    if (!matched) {
                        // Response body text
                        const responseText = entry.response.content?.text || '';
                        matched = responseText.toLowerCase().includes(searchQuery);
                    }

                    if (!matched) return false;
                }

                // 2. HTTP Method, Layer, and Latency Threshold Filters
                if (selectedMethod !== 'ALL') {
                    if (selectedMethod === 'FRONTEND') {
                        // Frontend requests are layout assets (HTML, CSS, JS, Fonts, Images)
                        const isApiOrBackend = mime.includes('json') || mime.includes('xml') || url.includes('/api/');
                        if (isApiOrBackend) return false;
                    } else if (selectedMethod === 'BACKEND') {
                        // Backend requests focus on state APIs, JSON, Server-driven actions or /api/ patterns
                        const isApiOrBackend = mime.includes('json') || mime.includes('xml') || url.includes('/api/');
                        if (!isApiOrBackend) return false;
                    } else if (selectedMethod === 'LATENCY_FAST') {
                        // Display requests resolved faster than Green limit
                        if (duration >= flowGreenLimit) return false;
                    } else if (selectedMethod === 'LATENCY_WARNING') {
                        // Display requests within Warning boundary ranges
                        if (duration < flowGreenLimit || duration > flowRedLimit) return false;
                    } else if (selectedMethod === 'LATENCY_CRITICAL') {
                        // Display requests exceeding Red limit
                        if (duration <= flowRedLimit) return false;
                    } else {
                        // Direct HTTP method match
                        if (method !== selectedMethod) return false;
                    }
                }

                // 3. Host / Origin Filter
                if (selectedHost !== 'ALL') {
                    try {
                        const parsedUrl = new URL(entry.request.url);
                        if (parsedUrl.hostname !== selectedHost) return false;
                    } catch (e) {
                        return false; 
                    }
                }

                // 4. Asset / MIME categories Toggle Filter
                if (activeFilterMime !== 'all') {
                    if (activeFilterMime === 'xhr' && !mime.includes('json') && !mime.includes('xml')) return false;
                    if (activeFilterMime === 'document' && !mime.includes('html')) return false;
                    if (activeFilterMime === 'script' && !mime.includes('javascript') && !mime.includes('js')) return false;
                    if (activeFilterMime === 'style' && !mime.includes('css')) return false;
                    if (activeFilterMime === 'image' && !mime.includes('image') && !mime.includes('png') && !mime.includes('jpeg') && !mime.includes('webp') && !mime.includes('gif')) return false;
                }

                return true;
            });

            // Re-render both views with matching filters
            renderWaterfallRows(filteredEntries);
            renderFlowPathway(filteredEntries);
        }

        function toggleMimeFilter(category) {
            activeFilterMime = category;
            
            // Adjust Styles dynamically on clicked element
            document.querySelectorAll('.mime-btn').forEach(btn => {
                btn.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-500');
                btn.classList.add('bg-slate-900', 'text-slate-400', 'border-slate-800');
            });

            const activeBtn = document.getElementById(`mime-btn-${category}`);
            if (activeBtn) {
                activeBtn.classList.remove('bg-slate-900', 'text-slate-400', 'border-slate-800');
                activeBtn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-500');
            }

            applyFilters();
        }

        function resetFilters() {
            document.getElementById('filter-search').value = '';
            document.getElementById('filter-method').value = 'ALL';
            document.getElementById('filter-host').value = 'ALL';
            clearLocatorMatches();
            toggleMimeFilter('all');
        }

        // Timing Progression Waterfall Renderer
        function renderWaterfallRows(entries) {
            const rowsContainer = document.getElementById('waterfall-rows');
            rowsContainer.innerHTML = '';
            
            document.getElementById('waterfall-count').innerText = entries.length;

            if (entries.length === 0) {
                rowsContainer.innerHTML = `
                    <div class="p-8 text-center text-slate-500 text-xs font-semibold">
                        No requests matching active tactical filters.
                    </div>
                `;
                return;
            }

            // Map session boundary anchors to establish relative waterfall positions
            let sessionStartTime = Infinity;
            let sessionEndTime = -Infinity;

            entries.forEach(entry => {
                const t = new Date(entry.startedDateTime).getTime();
                if (t < sessionStartTime) sessionStartTime = t;
                const end = t + (entry.time || 0);
                if (end > sessionEndTime) sessionEndTime = end;
            });

            const totalSessionRange = sessionEndTime - sessionStartTime;

            entries.forEach((entry, index) => {
                const url = entry.request.url;
                const shortUrl = url.split('/').pop() || url;
                const domain = new URL(url).hostname;

                const status = entry.response.status;
                const method = entry.request.method;
                const sizeBytes = entry.response.bodySize > 0 ? entry.response.bodySize : 0;
                const sizeKb = sizeBytes > 0 ? `${(sizeBytes / 1024).toFixed(1)} KB` : '0 KB';
                const duration = Math.round(entry.time || 0);

                // Timing relative calculations
                const entryStartTime = new Date(entry.startedDateTime).getTime();
                const relativeStartPercent = totalSessionRange > 0 ? ((entryStartTime - sessionStartTime) / totalSessionRange) * 100 : 0;
                const relativeWidthPercent = totalSessionRange > 0 ? ((entry.time || 0) / totalSessionRange) * 100 : 100;

                // Decompose timing parameters safely
                const tim = entry.timings || {};
                const blocked = Math.max(0, tim.blocked || 0);
                const dns = Math.max(0, tim.dns || 0);
                const connect = Math.max(0, tim.connect || 0);
                const ssl = Math.max(0, tim.ssl || 0);
                const wait = Math.max(0, tim.wait || 0);
                const receive = Math.max(0, tim.receive || 0);

                const timingSum = blocked + dns + connect + ssl + wait + receive;
                
                // Proportion segments mapping
                const pBlocked = timingSum > 0 ? (blocked / timingSum) * 100 : 0;
                const pDns = timingSum > 0 ? (dns / timingSum) * 100 : 0;
                const pConnect = timingSum > 0 ? (connect / timingSum) * 100 : 0;
                const pSsl = timingSum > 0 ? (ssl / timingSum) * 100 : 0;
                const pWait = timingSum > 0 ? (wait / timingSum) * 100 : 0;
                const pReceive = timingSum > 0 ? (receive / timingSum) * 100 : 0;

                // Status code color mapper
                let statusBg = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                if (status >= 300 && status < 400) statusBg = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
                else if (status >= 400 && status < 500) statusBg = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                else if (status >= 500) statusBg = "bg-rose-500/10 text-rose-400 border border-rose-500/20";

                // Method Badge Style mapper
                let methodBg = "text-indigo-400 bg-indigo-500/10";
                if (method === 'POST') methodBg = "text-emerald-400 bg-emerald-500/10";
                else if (method === 'DELETE') methodBg = "text-rose-400 bg-rose-500/10";

                const rowDiv = document.createElement('div');
                rowDiv.className = `grid grid-cols-12 gap-2 p-2 text-xs items-center hover:bg-slate-800/40 cursor-pointer transition-all duration-150 border-b border-slate-900/40 ${selectedRowIndex === index ? 'bg-indigo-500/10' : ''}`;
                rowDiv.onclick = () => openDetails(entry, index);

                rowDiv.innerHTML = `
                    <div class="col-span-3 truncate" title="${url}">
                        <p class="font-bold text-slate-200 truncate font-mono text-[11px]">${shortUrl}</p>
                        <p class="text-[9px] text-slate-500 truncate mt-0.5">${domain}</p>
                    </div>
                    <div class="col-span-1 text-center font-bold">
                        <span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider ${methodBg}">${method}</span>
                    </div>
                    <div class="col-span-1 text-center">
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${statusBg}">${status || 'Cancelled'}</span>
                    </div>
                    <div class="col-span-1 text-right font-mono text-slate-400">${sizeKb}</div>
                    <div class="col-span-1 text-right font-mono font-semibold text-slate-300">${duration} ms</div>
                    
                    <!-- Chronological Bar graph representation -->
                    <div class="col-span-5 relative py-1.5 select-none h-full flex items-center">
                        <div class="absolute inset-y-0 right-0 flex justify-between w-full h-full border-l border-r border-slate-800/10 pointer-events-none"></div>
                        <div class="w-full bg-slate-800/40 rounded h-2.5 overflow-hidden relative" style="margin-left: ${relativeStartPercent}%; width: ${Math.max(1, relativeWidthPercent)}%">
                            <div class="h-full flex">
                                <div style="width: ${pBlocked}%" class="bg-slate-500 flex-shrink-0" title="Blocked: ${Math.round(blocked)}ms"></div>
                                <div style="width: ${pDns}%" class="bg-orange-400 flex-shrink-0" title="DNS: ${Math.round(dns)}ms"></div>
                                <div style="width: ${pConnect}%" class="bg-violet-400 flex-shrink-0" title="Connect: ${Math.round(connect)}ms"></div>
                                <div style="width: ${pSsl}%" class="bg-amber-400 flex-shrink-0" title="SSL: ${Math.round(ssl)}ms"></div>
                                <div style="width: ${pWait}%" class="bg-emerald-400 flex-shrink-0" title="TTFB Wait: ${Math.round(wait)}ms"></div>
                                <div style="width: ${pReceive}%" class="bg-sky-400 flex-shrink-0" title="Download: ${Math.round(receive)}ms"></div>
                            </div>
                        </div>
                    </div>
                `;

                rowsContainer.appendChild(rowDiv);
            });
        }

        // Sub-Tab detail drawer management
        function openDetails(entry, index) {
            selectedRowIndex = index;
            currentlySelectedRequest = entry; // Save entry state
            
            // Toggle row highlighting
            applyFilters();

            // Clear previous AI output
            document.getElementById('ai-explainer-output').innerHTML = '';
            document.getElementById('ai-explainer-output-container').classList.add('hidden');
            document.getElementById('ai-explainer-loading').classList.add('hidden');

            // Open Detail Element
            document.getElementById('details-drawer').classList.remove('hidden');
            
            // Scroll detail drawer into view for smooth UX
            document.getElementById('details-drawer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // Populate Basic Specs
            document.getElementById('detail-method').innerText = entry.request.method;
            document.getElementById('detail-url').innerText = entry.request.url;

            // Method Style mapping updates on detail badge
            const mBadge = document.getElementById('detail-method');
            mBadge.className = "px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase " + 
                (entry.request.method === 'POST' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300');

            // Set Timing specifics
            const tim = entry.timings || {};
            document.getElementById('t-blocked').innerText = `${Math.round(tim.blocked || 0)}ms`;
            document.getElementById('t-dns').innerText = `${Math.round(tim.dns || 0)}ms`;
            document.getElementById('t-connect').innerText = `${Math.round(tim.connect || 0)}ms`;
            document.getElementById('t-ssl').innerText = `${Math.round(tim.ssl || 0)}ms`;
            document.getElementById('t-wait').innerText = `${Math.round(tim.wait || 0)}ms`;
            document.getElementById('t-receive').innerText = `${Math.round(tim.receive || 0)}ms`;
            document.getElementById('t-total').innerText = `${Math.round(entry.time || 0)}ms`;

            // Render Header arrays
            const reqHdrContainer = document.getElementById('detail-req-headers');
            const resHdrContainer = document.getElementById('detail-res-headers');
            reqHdrContainer.innerHTML = '';
            resHdrContainer.innerHTML = '';

            entry.request.headers.forEach(hdr => {
                reqHdrContainer.appendChild(createHeaderRow(hdr.name, hdr.value));
            });

            entry.response.headers.forEach(hdr => {
                resHdrContainer.appendChild(createHeaderRow(hdr.name, hdr.value));
            });

            // Render Cookie lists
            const cookieContainer = document.getElementById('detail-cookies-content');
            cookieContainer.innerHTML = '';
            
            const reqCookies = entry.request.cookies || [];
            const resCookies = entry.response.cookies || [];

            if (reqCookies.length === 0 && resCookies.length === 0) {
                cookieContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-4 font-sans font-medium">No cookies detected in request/response headers.</p>';
            } else {
                if (reqCookies.length > 0) {
                    const section = document.createElement('div');
                    section.innerHTML = '<h6 class="font-bold text-indigo-400 mb-1 border-b border-slate-700 pb-0.5">Cookies Sent by Browser</h6>';
                    reqCookies.forEach(c => {
                        section.appendChild(createHeaderRow(c.name, c.value));
                    });
                    cookieContainer.appendChild(section);
                }
                if (resCookies.length > 0) {
                    const section = document.createElement('div');
                    section.innerHTML = '<h6 class="font-bold text-indigo-400 mb-1 border-b border-slate-700 pb-0.5 mt-3">Cookies Set by Server</h6>';
                    resCookies.forEach(c => {
                        section.appendChild(createHeaderRow(c.name, c.value));
                    });
                    cookieContainer.appendChild(section);
                }
            }

            // RESPONSE BODY LOGIC IMPLEMENTATION
            const responseTextCode = document.getElementById('response-content-text');
            const responseMeta = document.getElementById('response-meta');
            
            responsePayloadCache = ""; // Clear previous cache
            
            if (entry.response && entry.response.content) {
                const contentObj = entry.response.content;
                let rawPayload = contentObj.text || "";
                const mimeType = contentObj.mimeType || "unknown/format";
                const isBase64 = contentObj.encoding === "base64";

                responseMeta.innerText = `Type: ${mimeType} | Size: ${contentObj.size || rawPayload.length} bytes ${isBase64 ? '(Base64 Encoded)' : ''}`;

                if (!rawPayload) {
                    responseTextCode.innerText = "No response payload content captured in this HAR record.";
                    responsePayloadCache = "";
                } else {
                    // Safe Client Decoders
                    let decodedText = rawPayload;
                    if (isBase64) {
                        try {
                            decodedText = atob(rawPayload);
                        } catch (err) {
                            decodedText = `[Base64 Decoding Failed: Binary Content or Unsupported Characters]\n\nRaw Text:\n${rawPayload}`;
                        }
                    }

                    // Prettify JSON if detected
                    try {
                        const parsedJson = JSON.parse(decodedText);
                        decodedText = JSON.stringify(parsedJson, null, 2);
                    } catch (e) {
                        // Skip styling if not JSON format
                    }

                    responseTextCode.innerText = decodedText;
                    responsePayloadCache = decodedText; // Cache for clipboard exports
                }
            } else {
                responseMeta.innerText = "";
                responseTextCode.innerText = "No response content object available inside this entry schema.";
                responsePayloadCache = "";
            }

            // Always default back to headers sub-tab
            switchDetailSubTab('headers');
        }

        function createHeaderRow(name, value) {
            const div = document.createElement('div');
            div.className = "flex py-1 hover:bg-slate-900/50 rounded px-1.5 transition-colors duration-150";
            div.innerHTML = `
                <span class="font-bold text-slate-400 mr-2 flex-shrink-0 break-all select-all">${name}:</span>
                <span class="text-slate-200 break-all select-all">${value}</span>
            `;
            return div;
        }

        function closeDetails() {
            document.getElementById('details-drawer').classList.add('hidden');
            selectedRowIndex = null;
            applyFilters();
        }

        function switchDetailSubTab(subTab) {
            document.querySelectorAll('.sub-panel').forEach(panel => panel.classList.add('hidden'));
            
            // Normalize Sub-Tab buttons
            ['headers', 'cookies', 'timing', 'response', 'ai-explainer'].forEach(tab => {
                const btn = document.getElementById(`subtab-${tab}`);
                if (btn) {
                    btn.classList.remove('bg-slate-800', 'text-slate-100');
                    if (tab === 'ai-explainer' || tab === 'response') {
                        btn.classList.add('text-indigo-400', 'hover:text-indigo-300');
                    } else {
                        btn.classList.add('text-slate-400', 'hover:text-slate-200');
                    }
                }
            });

            // Activate Target
            document.getElementById(`detail-sub-${subTab}`).classList.remove('hidden');
            const targetBtn = document.getElementById(`subtab-${subTab}`);
            if (targetBtn) {
                targetBtn.classList.add('bg-slate-800', 'text-slate-100');
                targetBtn.classList.remove('text-slate-400', 'hover:text-slate-200', 'text-indigo-400', 'hover:text-indigo-300');
            }
        }

        // Copy response text function
        function copyResponseContent() {
            if (!responsePayloadCache) {
                showNotification("No response payload available to copy.", "error");
                return;
            }
            const dummy = document.createElement("textarea");
            document.body.appendChild(dummy);
            dummy.value = responsePayloadCache;
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);

            const copyBtnText = document.getElementById('copy-response-btn-text');
            copyBtnText.innerText = "Copied Payload!";
            setTimeout(() => {
                copyBtnText.innerText = "Copy Response";
            }, 2000);
        }

        // Latency Flow Pathway Configuration
        function updateFlowThresholds() {
            flowGreenLimit = parseInt(document.getElementById('slider-green-limit').value);
            flowRedLimit = parseInt(document.getElementById('slider-red-limit').value);

            // Sync visual labels
            document.getElementById('green-limit-val').innerText = flowGreenLimit;
            document.getElementById('red-limit-val').innerText = flowRedLimit;

            // Enforce logic: Green must be less than Red
            if (flowGreenLimit >= flowRedLimit) {
                flowRedLimit = flowGreenLimit + 50;
                document.getElementById('slider-red-limit').value = flowRedLimit;
                document.getElementById('red-limit-val').innerText = flowRedLimit;
            }

            // Re-apply filters globally to update lists and charts
            applyFilters();
        }

        function renderFlowPathway(entries) {
            const flowContainer = document.getElementById('flow-steps-output');
            flowContainer.innerHTML = '';

            if (!parsedHarData) {
                flowContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-12">Load a session to map and evaluate network chronological sequencing flows.</p>';
                return;
            }

            // Compute global (unfiltered) KPI counters for general performance awareness
            let greenTotal = 0;
            let orangeTotal = 0;
            let redTotal = 0;

            parsedHarData.log.entries.forEach(e => {
                const duration = Math.round(e.time || 0);
                if (duration < flowGreenLimit) greenTotal++;
                else if (duration >= flowGreenLimit && duration <= flowRedLimit) orangeTotal++;
                else redTotal++;
            });

            document.getElementById('flow-count-green').innerText = greenTotal;
            document.getElementById('flow-count-orange').innerText = orangeTotal;
            document.getElementById('flow-count-red').innerText = redTotal;

            if (entries.length === 0) {
                flowContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-12">No requests matched current active filters.</p>';
                return;
            }

            // Establish base session timeline start anchor
            let baseSessionTime = Infinity;
            parsedHarData.log.entries.forEach(e => {
                const t = new Date(e.startedDateTime).getTime();
                if (t < baseSessionTime) baseSessionTime = t;
            });

            entries.forEach((entry, filteredIndex) => {
                const duration = Math.round(entry.time || 0);
                const startTimeOffset = new Date(entry.startedDateTime).getTime() - baseSessionTime;
                const method = entry.request.method;
                const url = entry.request.url;
                const shortUrl = url.split('/').pop() || url;
                const domain = new URL(url).hostname;

                // Find original raw parsed array index for linked actions
                const originalIndex = parsedHarData.log.entries.indexOf(entry);

                // Timing category evaluation based on dynamic sliders
                let latencyClass = "";
                let latencyBadgeColor = "";
                let indicatorNodeColor = "";
                let descriptionNote = "";

                if (duration < flowGreenLimit) {
                    latencyClass = "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 latency-green";
                    latencyBadgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                    indicatorNodeColor = "bg-emerald-500 shadow-emerald-500/30";
                    descriptionNote = "🟢 Fast Asset Load Time — Optimized Resource";
                } else if (duration >= flowGreenLimit && duration <= flowRedLimit) {
                    latencyClass = "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 latency-amber";
                    latencyBadgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                    indicatorNodeColor = "bg-amber-500 shadow-amber-500/30";
                    descriptionNote = "🟡 Warning — Review compression or caching parameters";
                } else {
                    latencyClass = "border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40 latency-rose";
                    latencyBadgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                    indicatorNodeColor = "bg-rose-500 shadow-rose-500/30";
                    descriptionNote = "🔴 Critical Latency Bottleneck — Blocks UI execution";
                }

                // Append flow step element
                const stepDiv = document.createElement('div');
                stepDiv.className = "relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-xl transition-all duration-150 cursor-pointer " + latencyClass;
                stepDiv.onclick = () => {
                    openDetails(entry, originalIndex);
                };

                stepDiv.innerHTML = `
                    <!-- Chronological node dot decoration -->
                    <div class="absolute -left-[41px] top-6 w-4 h-4 rounded-full border-4 border-slate-900 shadow-md ${indicatorNodeColor}"></div>
                    
                    <div class="space-y-1 truncate max-w-xl pr-2">
                        <div class="flex items-center space-x-2">
                            <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-slate-900 text-slate-400">${method}</span>
                            <span class="text-[10px] font-mono font-bold text-slate-500">+${startTimeOffset}ms offset</span>
                            <span class="text-[10px] text-slate-400 italic">${descriptionNote}</span>
                        </div>
                        <p class="font-bold text-slate-200 text-[11px] font-mono truncate break-all">${shortUrl}</p>
                        <p class="text-[9px] text-slate-500 font-mono truncate">${domain}</p>
                    </div>

                    <!-- Latency indicator badges -->
                    <div class="flex items-center space-x-3 flex-shrink-0">
                        <div class="text-right">
                            <p class="text-[10px] text-slate-500 font-mono">Response Time</p>
                            <p class="text-xs font-bold text-slate-300 font-mono">${duration} ms</p>
                        </div>
                        <span class="px-2.5 py-1 text-xs font-mono font-bold rounded-lg border ${latencyBadgeColor}">${duration}ms</span>
                    </div>
                `;

                flowContainer.appendChild(stepDiv);
            });
        }

        // General navigation Tabs
        function switchTab(tabId) {
            document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
            
            // Normalize header buttons
            ['waterfall', 'flow-pipeline', 'ai-suite', 'sanitizer', 'consent', 'deployment'].forEach(tab => {
                const btn = document.getElementById(`tab-${tab}-btn`);
                if (btn) {
                    btn.classList.remove('bg-slate-800', 'text-white');
                    if (tab === 'ai-suite') {
                        btn.classList.add('text-indigo-400', 'hover:text-indigo-300');
                    } else if (tab === 'flow-pipeline') {
                        btn.classList.add('text-teal-400', 'hover:text-teal-300');
                    } else {
                        btn.classList.add('text-slate-400', 'hover:text-slate-200');
                    }
                }
            });

            // Activate Target
            document.getElementById(`panel-${tabId}`).classList.remove('hidden');
            const targetBtn = document.getElementById(`tab-${tabId}-btn`);
            if (targetBtn) {
                targetBtn.classList.add('bg-slate-800', 'text-white');
                targetBtn.classList.remove('text-slate-400', 'hover:text-slate-200', 'text-indigo-400', 'hover:text-indigo-300', 'text-teal-400', 'hover:text-teal-300');
            }
        }

        // Local Sanitization Sandbox Actions
        function executeSanitisation() {
            if (!parsedHarData) {
                showNotification("No HAR data loaded. Upload or load Demo first.", "error");
                return;
            }

            document.getElementById('sanitize-status').innerText = "Sanitizing payload details...";

            // Perform deep copy to protect active loaded logs representation
            const copyData = JSON.parse(JSON.stringify(parsedHarData));

            const redactAuth = document.getElementById('sanitize-auth').checked;
            const stripCookies = document.getElementById('sanitize-cookies').checked;
            const redactQuery = document.getElementById('sanitize-query').checked;

            copyData.log.entries.forEach(entry => {
                // Sanitise Headers
                if (redactAuth) {
                    const sensitiveHeaders = ['authorization', 'proxy-authorization', 'cookie', 'x-api-key', 'set-cookie'];
                    if (entry.request && entry.request.headers) {
                        entry.request.headers.forEach(h => {
                            if (sensitiveHeaders.includes(h.name.toLowerCase())) {
                                h.value = "[REDACTED_BY_AETHERHAR]";
                            }
                        });
                    }
                    if (entry.response && entry.response.headers) {
                        entry.response.headers.forEach(h => {
                            if (sensitiveHeaders.includes(h.name.toLowerCase())) {
                                h.value = "[REDACTED_BY_AETHERHAR]";
                            }
                        });
                    }
                }

                // Strip Server Cookies Arrays
                if (stripCookies) {
                    if (entry.request) entry.request.cookies = [];
                    if (entry.response) entry.response.cookies = [];
                }

                // Mask Query String Values
                if (redactQuery && entry.request && entry.request.queryString) {
                    const sensitiveQueryParams = ['token', 'secret', 'code', 'apikey', 'password', 'pass', 'auth_token'];
                    entry.request.queryString.forEach(q => {
                        if (sensitiveQueryParams.includes(q.name.toLowerCase())) {
                            q.value = "[REDACTED_VALUE]";
                        }
                    });

                    // Reconstruct relative URL to match parameter changes
                    try {
                        const parsedUrl = new URL(entry.request.url);
                        sensitiveQueryParams.forEach(p => {
                            if (parsedUrl.searchParams.has(p)) {
                                parsedUrl.searchParams.set(p, "[REDACTED_VALUE]");
                            }
                        });
                        entry.request.url = parsedUrl.toString();
                    } catch (e) {
                        // Suppress URL reconstruction exceptions
                    }
                }
            });

            // Convert back to document and trigger secure client download stream
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(copyData, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `sanitized_${currentFileRef ? currentFileRef.name : 'session'}.har`);
            dlAnchorElem.click();

            document.getElementById('sanitize-status').innerText = "Sanitization complete! File downloaded.";
            showNotification("Successfully completed local redaction pass and exported sanitized HAR file.", "success");
        }

        // Consent Event Audit logic (GDPR boundary validation)
        function auditConsentViolations() {
            const container = document.getElementById('consent-violations-container');
            container.innerHTML = '';

            if (!parsedHarData) {
                container.innerHTML = '<p class="text-xs text-slate-500 text-center py-6">Please load a session to trigger consent validation.</p>';
                return;
            }

            const offsetThreshold = parseInt(document.getElementById('consent-offset-input').value) || 0;

            // Find absolute base start timestamp
            let firstEntryTime = Infinity;
            parsedHarData.log.entries.forEach(e => {
                const t = new Date(e.startedDateTime).getTime();
                if (t < firstEntryTime) firstEntryTime = t;
            });

            const consentBoundTime = firstEntryTime + offsetThreshold;

            let violations = 0;

            parsedHarData.log.entries.forEach(entry => {
                const url = entry.request.url;
                const entryTime = new Date(entry.startedDateTime).getTime();

                // Assess if a 3rd party host executes before consent timestamp
                if (isThirdPartyTracker(url) && entryTime < consentBoundTime) {
                    violations++;
                    const delayFromStart = entryTime - firstEntryTime;

                    const row = document.createElement('div');
                    row.className = "flex items-start justify-between p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl hover:border-rose-500/30 transition-all duration-150 text-xs";
                    row.innerHTML = `
                        <div class="space-y-0.5 truncate pr-4">
                            <p class="font-bold text-rose-300 font-mono break-all truncate">${url}</p>
                            <p class="text-[10px] text-slate-500">First fired at: <span class="font-mono text-slate-400 font-bold">+${delayFromStart}ms</span> from startup</p>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-bold tracking-wide flex-shrink-0 uppercase font-mono">NON-COMPLIANT</span>
                    `;
                    container.appendChild(row);
                }
            });

            // Adjust counters & badges
            const badge = document.getElementById('consent-violation-badge');
            badge.innerText = `${violations} Violations`;
            if (violations > 0) {
                badge.className = "px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded-full font-mono font-bold animate-pulse";
            } else {
                badge.className = "px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-full font-mono font-bold";
                container.innerHTML = `
                    <div class="py-8 text-center text-slate-500 space-y-2">
                        <svg class="w-8 h-8 text-emerald-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <p class="text-xs font-semibold text-slate-300">Perfect compliance score! No third-party script traces executed pre-consent.</p>
                    </div>
                `;
            }
        }

        // Custom notification management
        function showNotification(message, type = 'success') {
            const box = document.getElementById('notification-box');
            const msgSpan = document.getElementById('notification-message');
            
            box.classList.remove('hidden', 'bg-emerald-500/10', 'border-emerald-500/20', 'text-emerald-400', 'bg-rose-500/10', 'border-rose-500/20', 'text-rose-400');

            if (type === 'success') {
                box.classList.add('bg-emerald-500/10', 'border-emerald-500/20', 'text-emerald-400');
            } else {
                box.classList.add('bg-rose-500/10', 'border-rose-500/20', 'text-rose-400');
            }

            msgSpan.innerText = message;
            box.classList.remove('hidden');

            // Autohide notifications after 6 seconds
            setTimeout(dismissNotification, 6000);
        }

        function dismissNotification() {
            document.getElementById('notification-box').classList.add('hidden');
        }

        // Code Sandbox File Switcher
        function switchCodeFile(fileId) {
            activeCodeFileId = fileId;
            document.querySelectorAll('.code-block').forEach(block => block.classList.add('hidden'));
            
            // Revert active states on buttons
            ['app-py', 'gunicorn-conf', 'requirements-txt', 'procfile'].forEach(fid => {
                const btn = document.getElementById(`btn-file-${fid}`);
                if (btn) {
                    btn.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-500/30');
                    btn.classList.add('bg-slate-900', 'text-slate-400', 'border-slate-800');
                }
            });

            // Activate Target Code element
            document.getElementById(`code-block-${fileId}`).classList.remove('hidden');
            const targetBtn = document.getElementById(`btn-file-${fileId}`);
            if (targetBtn) {
                targetBtn.classList.remove('bg-slate-900', 'text-slate-400', 'border-slate-800');
                targetBtn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-500/30');
            }
        }

        function copyCurrentCode() {
            const activeCodePre = document.querySelector(`#code-block-${activeCodeFileId} code`);
            if (!activeCodePre) return;

            const text = activeCodePre.innerText;
            const dummy = document.createElement("textarea");
            document.body.appendChild(dummy);
            dummy.value = text;
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);

            const copyBtnText = document.getElementById('copy-btn-text');
            copyBtnText.innerText = "Copied!";
            setTimeout(() => {
                copyBtnText.innerText = "Copy";
            }, 2000);
        }

        // ==========================================
        // ✨ CLAUDE API LLM INTEGRATION MECHANICS
        // ==========================================
        async function callGemini(systemPrompt, userQuery) {
            // Calls the secure backend Claude proxy - API key never exposed to frontend
            const backendUrl = '/api/claude/analyze';

            try {
                const response = await fetch(backendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        har_data: { system_prompt: systemPrompt },
                        analysis_prompt: userQuery
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    const detail = error.detail || 'AI analysis failed';
                    if (response.status === 503) {
                        throw new Error('No Claude API key configured. Please add one in the admin panel (/admin).');
                    }
                    throw new Error(detail);
                }

                const result = await response.json();

                if (!result.analysis) {
                    throw new Error("No response received from AI model");
                }

                return result.analysis;
            } catch (err) {
                throw new Error(`${err.message}`);
            }
        }

        // Action: Explain Selected Request on Waterfall
        async function runRequestAiExplainer() {
            if (!currentlySelectedRequest) return;
            
            const container = document.getElementById('ai-explainer-output-container');
            const output = document.getElementById('ai-explainer-output');
            const loading = document.getElementById('ai-explainer-loading');
            
            container.classList.add('hidden');
            loading.classList.remove('hidden');
            output.innerHTML = '';

            // Extract relevant request features to avoid token bloat
            const metadataSummary = {
                url: currentlySelectedRequest.request.url,
                method: currentlySelectedRequest.request.method,
                status: currentlySelectedRequest.response.status,
                mimeType: currentlySelectedRequest.response.content?.mimeType || 'unknown',
                timings: currentlySelectedRequest.timings,
                requestHeaders: currentlySelectedRequest.request.headers.slice(0, 15),
                responseHeaders: currentlySelectedRequest.response.headers.slice(0, 15),
            };

            const systemPrompt = `You are an expert Backend API Architect and Web Security Engineer. Your task is to analyze the provided HTTP network request metadata captured from a HAR file, dissect its architectural role, evaluate its response status and performance timings, and generate a brief, hyper-practical markdown report. 

Always include:
1. **Endpoint Analysis**: What role does this endpoint play in the application?
2. **Performance Verdict**: Evaluate timings (especially TTFB, DNS resolve, or connection overhead). Identify any obvious bottlenecks.
3. **Replication Script**: Provide a functional Python 'requests' snippet or a 'curl' command mimicking this request, with correct headers.`;

            const query = `Here is the HTTP request captured in the HAR timeline:\n\n${JSON.stringify(metadataSummary, null, 2)}`;

            try {
                const markdownResponse = await callGemini(systemPrompt, query);
                output.innerHTML = marked.parse(markdownResponse);
                loading.classList.add('hidden');
                container.classList.remove('hidden');
            } catch (err) {
                loading.classList.add('hidden');
                output.innerHTML = `<div class="p-3 bg-rose-900/20 text-rose-400 rounded-lg border border-rose-800/50">Error calling Claude: ${err.message}</div>`;
                container.classList.remove('hidden');
            }
        }

        // Action: Run Performance/Security scans on general HAR
        async function runGeneralAiDiagnostics(auditType) {
            if (!parsedHarData) {
                showNotification("Please load a HAR session first before triggering diagnostic runs.", "error");
                return;
            }

            const screen = document.getElementById('ai-diagnostic-screen-container');
            const loading = document.getElementById('ai-screen-loading');
            const resultBox = document.getElementById('ai-screen-result-box');
            const outputDiv = document.getElementById('ai-screen-markdown-output');
            const titleSpan = document.getElementById('ai-screen-title');

            screen.classList.remove('hidden');
            loading.classList.remove('hidden');
            resultBox.classList.add('hidden');
            outputDiv.innerHTML = '';

            // Set Title Context
            titleSpan.innerText = auditType === 'performance' ? '✨ AI Performance Analytics Report' : '✨ AI Security & Compliance Report';

            // Gather lightweight session summary
            const summaryStats = {
                total_requests: parsedHarData.log.entries.length,
                mime_distribution: {},
                domain_distribution: {},
                timing_extremes: { longest: 0, longest_url: '' },
                third_parties_count: 0,
                page_size_est_bytes: 0
            };

            parsedHarData.log.entries.forEach(entry => {
                const url = entry.request.url;
                const domain = new URL(url).hostname;
                const mime = entry.response.content?.mimeType || 'unknown';
                const size = (entry.response.bodySize || 0) + (entry.response.headersSize || 0);

                summaryStats.mime_distribution[mime] = (summaryStats.mime_distribution[mime] || 0) + 1;
                summaryStats.domain_distribution[domain] = (summaryStats.domain_distribution[domain] || 0) + 1;
                summaryStats.page_size_est_bytes += size;

                if (entry.time > summaryStats.timing_extremes.longest) {
                    summaryStats.timing_extremes.longest = entry.time;
                    summaryStats.timing_extremes.longest_url = url;
                }

                if (isThirdPartyTracker(url)) {
                    summaryStats.third_parties_count++;
                }
            });

            // Convert map distributions into lightweight arrays
            summaryStats.mime_distribution = Object.entries(summaryStats.mime_distribution).sort((a,b)=>b[1]-a[1]).slice(0, 10);
            summaryStats.domain_distribution = Object.entries(summaryStats.domain_distribution).sort((a,b)=>b[1]-a[1]).slice(0, 10);

            let systemPrompt = "";
            let query = `Below are network statistics collected from the HAR file:\n\n${JSON.stringify(summaryStats, null, 2)}`;

            if (auditType === 'performance') {
                systemPrompt = `You are an elite Performance Architect specializing in Lighthouse Web Vitals and HTTP/2/3 network delivery models. Analyze the provided session metrics captured in the HAR trace, identify the absolute worst latency bottlenecks (like slow static assets, uncompressed assets, high TTFB endpoints, or excess third party scripts), and provide a formal performance optimization report. 
                
Format the report with these sections:
- **Executive Summary**: General performance grade of the trace.
- **Top Bottlenecks**: Pinpoint where the load time was wasted.
- **Actionable Optimization Steps**: Concrete technical instructions for CDNs, bundling, caching strategies, and lazy loading. Use bullet points and markdown.`;
            } else {
                systemPrompt = `You are an elite Cyber Security Auditor & Web Pen-tester. Look at the session summary of the loaded web trace. Detail any high-level risks or compliance violations:
- Expose security implications of loaded domains.
- Pinpoint missing server header recommendations (CSP, HSTS, CORS).
- Advise on potential leakage vectors (tracking assets, insecure cookies).
- Suggest critical mitigation practices. Format with clear, structured markdown.`;
            }

            try {
                const markdownResponse = await callGemini(systemPrompt, query);
                aiReportTextCache = markdownResponse; // Cache for copy
                outputDiv.innerHTML = marked.parse(markdownResponse);
                loading.classList.add('hidden');
                resultBox.classList.remove('hidden');
            } catch (err) {
                loading.classList.add('hidden');
                outputDiv.innerHTML = `<div class="p-3 bg-rose-900/20 text-rose-400 rounded-lg border border-rose-800/50 font-sans">Error invoking Claude: ${err.message}</div>`;
                resultBox.classList.remove('hidden');
            }
        }

        function copyAiScreenOutput() {
            if (!aiReportTextCache) return;
            const dummy = document.createElement("textarea");
            document.body.appendChild(dummy);
            dummy.value = aiReportTextCache;
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);

            const copyBtnText = document.getElementById('ai-copy-btn-text');
            copyBtnText.innerText = "Report Copied!";
            setTimeout(() => {
                copyBtnText.innerText = "Copy Report";
            }, 2000);
        }

        // Rich Interactive Demo dataset mock generator
        function loadDemoHAR() {
            const demoHar = {
                log: {
                    version: "1.2",
                    creator: { name: "AetherHAR Engine Mock", version: "1.0" },
                    pages: [
                        {
                            id: "page_1",
                            title: "Enterprise Storefront",
                            pageTimings: { onLoad: 1350 }
                        }
                    ],
                    entries: [
                        {
                            startedDateTime: "2200-01-01T12:00:00.000Z",
                            time: 120,
                            request: {
                                method: "GET",
                                url: "https://storefront.domain.com/",
                                headers: [
                                    { name: "Host", value: "storefront.domain.com" },
                                    { name: "User-Agent", value: "AetherHAR-Agent/1.0" }
                                ],
                                cookies: []
                            },
                            response: {
                                status: 200,
                                bodySize: 12400,
                                headersSize: 500,
                                content: { mimeType: "text/html; charset=utf-8", text: "<!DOCTYPE html>\n<html>\n<head>\n  <title>Mock Storefront HTML</title>\n</head>\n<body>\n  <h1>Welcome to Enterprise Storefront</h1>\n</body>\n</html>" },
                                headers: [
                                    { name: "Content-Type", value: "text/html; charset=utf-8" },
                                    { name: "Server", value: "gunicorn/Heroku" }
                                ],
                                cookies: []
                            },
                            timings: { blocked: 5, dns: 15, connect: 30, ssl: 20, wait: 35, receive: 15 }
                        },
                        {
                            startedDateTime: "2200-01-01T12:00:00.080Z",
                            time: 250,
                            request: {
                                method: "GET",
                                url: "https://storefront.domain.com/static/css/styles.css",
                                headers: [{ name: "Accept", value: "text/css" }],
                                cookies: []
                            },
                            response: {
                                status: 200,
                                bodySize: 45200,
                                headersSize: 400,
                                content: { mimeType: "text/css", text: "body { background-color: #0f172a; color: #f1f5f9; }\n.header { border-bottom: 1px solid #1e293b; }" },
                                headers: [{ name: "Content-Type", value: "text/css" }],
                                cookies: []
                            },
                            timings: { blocked: 10, dns: 0, connect: 0, ssl: 0, wait: 140, receive: 100 }
                        },
                        {
                            startedDateTime: "2200-01-01T12:00:00.120Z",
                            time: 320,
                            request: {
                                method: "GET",
                                url: "https://storefront.domain.com/static/js/bundle.js",
                                headers: [{ name: "Accept", value: "*/*" }],
                                cookies: []
                            },
                            response: {
                                status: 200,
                                bodySize: 125000,
                                headersSize: 400,
                                content: { mimeType: "application/javascript", text: "console.log('Successfully loaded storefront bundle scripts.');\nfunction checkoutInit() { return true; }" },
                                headers: [{ name: "Content-Type", value: "application/javascript" }],
                                cookies: []
                            },
                            timings: { blocked: 15, dns: 0, connect: 0, ssl: 0, wait: 85, receive: 220 }
                        },
                        {
                            startedDateTime: "2200-01-01T12:00:00.150Z",
                            time: 310,
                            request: {
                                method: "POST",
                                url: "https://storefront.domain.com/api/v1/auth",
                                headers: [
                                    { name: "Authorization", value: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" },
                                    { name: "Content-Type", value: "application/json" }
                                ],
                                cookies: []
                            },
                            response: {
                                status: 200,
                                bodySize: 1500,
                                headersSize: 450,
                                content: { mimeType: "application/json", text: "{\"session_token\":\"987456123_abc_xyz\",\"user\":{\"id\":102,\"role\":\"admin\",\"name\":\"Store Administrator\"}}" },
                                headers: [{ name: "Content-Type", value: "application/json" }],
                                cookies: [{ name: "session_token", value: "987456123_abc_xyz" }]
                            },
                            timings: { blocked: 0, dns: 0, connect: 0, ssl: 0, wait: 295, receive: 15 }
                        },
                        {
                            startedDateTime: "2200-01-01T12:00:00.180Z",
                            time: 400,
                            request: {
                                method: "GET",
                                url: "https://storefront.domain.com/static/img/hero-banner.webp",
                                headers: [{ name: "Accept", value: "image/webp" }],
                                cookies: []
                            },
                            response: {
                                status: 200,
                                bodySize: 348200,
                                headersSize: 350,
                                content: { mimeType: "image/webp", text: "UklGRk4AAABXRUJQVlA4IDoAAADQAQCdASoBAAEALm00m0gkBQYAFAA/g27gA/gA/v3gAA==" , encoding: "base64" },
                                headers: [{ name: "Content-Type", value: "image/webp" }],
                                cookies: []
                            },
                            timings: { blocked: 5, dns: 0, connect: 0, ssl: 0, wait: 50, receive: 345 }
                        },
                        {
                            startedDateTime: "2200-01-01T12:00:00.220Z",
                            time: 90,
                            request: {
                                method: "GET",
                                url: "https://google-analytics.com/g/collect?v=2&id=UA-9988-2",
                                headers: [],
                                cookies: []
                            },
                            response: {
                                status: 204,
                                bodySize: 0,
                                headersSize: 150,
                                content: { mimeType: "image/gif", text: "" },
                                headers: [],
                                cookies: []
                            },
                            timings: { blocked: 2, dns: 10, connect: 22, ssl: 18, wait: 35, receive: 3 }
                        },
                        {
                            startedDateTime: "2200-01-01T12:00:00.310Z",
                            time: 140,
                            request: {
                                method: "GET",
                                url: "https://connect.facebook.net/en_US/fbevents.js",
                                headers: [],
                                cookies: []
                            },
                            response: {
                                status: 200,
                                bodySize: 6200,
                                headersSize: 300,
                                content: { mimeType: "application/javascript", text: "console.log('Facebook events pixel listener script initialized.');" },
                                headers: [],
                                cookies: []
                            },
                            timings: { blocked: 1, dns: 18, connect: 25, ssl: 20, wait: 60, receive: 16 }
                        },
                        {
                            startedDateTime: "2200-01-01T12:00:00.420Z",
                            time: 850,
                            request: {
                                method: "GET",
                                url: "https://storefront.domain.com/api/v1/products/recommendations",
                                headers: [],
                                cookies: []
                            },
                            response: {
                                status: 200,
                                bodySize: 18200,
                                headersSize: 450,
                                content: { mimeType: "application/json", text: "{\"products\":[{\"id\":1,\"name\":\"Premium Mechanical Keyboard\",\"price\":129.99},{\"id\":2,\"name\":\"Wireless Ergonomic Mouse\",\"price\":79.99}]}" },
                                headers: [],
                                cookies: []
                            },
                            timings: { blocked: 5, dns: 0, connect: 0, ssl: 0, wait: 820, receive: 25 }
                        },
                        {
                            startedDateTime: "2200-01-01T12:00:00.600Z",
                            time: 180,
                            request: {
                                method: "GET",
                                url: "https://storefront.domain.com/api/v1/checkout/cart",
                                headers: [],
                                cookies: []
                            },
                            response: {
                                status: 500,
                                bodySize: 120,
                                headersSize: 200,
                                content: { mimeType: "application/json", text: "{\"error\":\"Internal Server Error\",\"code\":500,\"trace_id\":\"err_9283741\"}" },
                                headers: [],
                                cookies: []
                            },
                            timings: { blocked: 1, dns: 0, connect: 0, ssl: 0, wait: 177, receive: 2 }
                        },
                        {
                            startedDateTime: "2200-01-01T12:00:01.050Z",
                            time: 60,
                            request: {
                                method: "GET",
                                url: "https://storefront.domain.com/favicon.ico",
                                headers: [],
                                cookies: []
                            },
                            response: {
                                status: 404,
                                bodySize: 0,
                                headersSize: 180,
                                content: { mimeType: "text/html", text: "<h1>404 Not Found</h1>" },
                                headers: [],
                                cookies: []
                            },
                            timings: { blocked: 0, dns: 0, connect: 0, ssl: 0, wait: 59, receive: 1 }
                        }
                    ]
                }
            };

            validateAndLoadHAR(demoHar, "demo_session_storefront.har");
        }
