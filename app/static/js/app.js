const { createApp, ref, reactive, onMounted, computed, nextTick, watch } = Vue;

const App = {
    setup() {
        // ==========================================
        // 1. GLOBAL STATE & MODALS
        // ==========================================
        const user = reactive({
            isAuthenticated: !!localStorage.getItem('auth_token'),
            token: localStorage.getItem('auth_token') || null,
            role: localStorage.getItem('user_role') || null,
            email: localStorage.getItem('user_email') || null,
            full_name: localStorage.getItem('user_name') || 'User',
            qualification: localStorage.getItem('user_qual') || '',
            created_at: '2000-01-01' 
        });

        const modal = reactive({ isVisible: false, title: '', message: '', type: 'primary', onConfirm: null });
        
        const showModal = (t, m, type='primary', cb=null) => { 
            modal.title = t; 
            modal.message = m; 
            modal.type = type; 
            modal.onConfirm = cb; 
            modal.isVisible = true; 
        };
        
        const closeModal = () => { modal.isVisible = false; };
        
        const confirmAction = () => { 
            if (modal.onConfirm) modal.onConfirm(); 
            closeModal(); 
        };

        // ==========================================
        // 2. AUTHENTICATION
        // ==========================================
        const isRegistering = ref(false); 
        const credentials = reactive({ email: '', password: '', full_name: '', qualification: '', dob: '' });
        
        const toggleAuthMode = () => { 
            isRegistering.value = !isRegistering.value; 
            Object.keys(credentials).forEach(k => credentials[k] = ''); 
        };

        const authAction = async () => {
            const endpoint = isRegistering.value ? '/api/auth/register' : '/api/auth/login';
            try {
                const res = await fetch(endpoint, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(credentials) 
                });
                const data = await res.json();
                
                if (res.ok) {
                    if (isRegistering.value) { 
                        showModal('Success', 'Registered! Please Login.', 'success'); 
                        toggleAuthMode(); 
                    } else {
                        user.isAuthenticated = true; 
                        user.token = data.user.token; 
                        user.role = data.user.role; 
                        user.email = data.user.email;
                        user.full_name = data.user.full_name || 'User'; 
                        user.qualification = data.user.qualification || '';
                        
                        localStorage.setItem('auth_token', 'true'); 
                        localStorage.setItem('user_role', data.user.role); 
                        localStorage.setItem('user_email', data.user.email); 
                        localStorage.setItem('user_name', user.full_name); 
                        localStorage.setItem('user_qual', user.qualification); 
                        
                        loadDashboard();
                    }
                } else { 
                    showModal('Error', data.message, 'danger'); 
                }
            } catch (e) { 
                showModal('System Error', 'Connection failed.', 'danger'); 
            }
        };

        const logout = async () => { 
            try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {} 
            user.isAuthenticated = false; 
            localStorage.clear(); 
            credentials.email = '';    // Clears the email field
            credentials.password = ''; // Clears the password field
        };

        // ==========================================
        // 3. LIVE NOTIFICATIONS
        // ==========================================
        const notifications = ref([]);
        const showNotifModal = ref(false);
        
        const openNotifications = async () => {
            try {
                const rolePath = user.role === 'admin' ? 'admin' : 'user';
                const res = await fetch(`/api/${rolePath}/notifications`);
                if (res.ok) {
                    notifications.value = await res.json();
                }
                showNotifModal.value = true;
            } catch(e) {
                console.error("Failed to load notifications", e);
            }
        };
        
        const closeNotifModal = () => { showNotifModal.value = false; };

        // ==========================================
        // 4. ADMIN: MANAGE CONTENT (CRUD)
        // ==========================================
        const adminView = ref('manage'); 
        const subjects = ref([]); 
        const newSubject = reactive({ name: '', description: '' }); 
        const searchQuery = ref(""); 
        
        const selectedSubject = ref(null); 
        const chapters = ref([]); 
        const newChapter = reactive({ name: '', description: '' }); 
        
        const selectedChapter = ref(null); 
        const quizzes = ref([]); 
        const newQuiz = reactive({ date_of_quiz: '', time_duration: 30, remarks: '' }); 
        
        const selectedQuiz = ref(null); 
        const questions = ref([]); 
        const newQuestion = reactive({ question_statement: '', option1: '', option2: '', option3: '', option4: '', correct_option: 1 });

        // --- Filter Logic ---
        const filteredSubjects = computed(() => {
            if (!searchQuery.value) return subjects.value;
            return subjects.value.filter(s => s.name.toLowerCase().includes(searchQuery.value.toLowerCase()));
        });

        // --- Fetch & Create ---
        const fetchSubjects = async () => { 
            try { 
                const res = await fetch('/api/admin/subjects'); 
                if(res.ok) subjects.value = await res.json(); 
            } catch(e){} 
        };
        
        const createSubject = async () => { 
            const res = await fetch('/api/admin/subjects', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(newSubject)
            }); 
            if(res.ok) { 
                showModal('Success', 'Subject Created!', 'success'); 
                subjects.value.push((await res.json()).subject); 
                newSubject.name = ''; 
                newSubject.description = ''; 
            } 
        };
        
        const viewChapters = async (s) => { 
            selectedSubject.value = s; 
            const res = await fetch(`/api/admin/subjects/${s.id}/chapters`); 
            if(res.ok) chapters.value = await res.json(); 
        };
        
        const createChapter = async () => { 
            const res = await fetch(`/api/admin/subjects/${selectedSubject.value.id}/chapters`, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(newChapter)
            }); 
            if(res.ok) { 
                showModal('Success', 'Chapter Added!', 'success'); 
                chapters.value.push((await res.json()).chapter); 
                newChapter.name = ''; 
                newChapter.description = ''; 
            } 
        };
        
        const viewQuizzes = async (c) => { 
            selectedChapter.value = c; 
            const res = await fetch(`/api/admin/chapters/${c.id}/quizzes`); 
            if(res.ok) quizzes.value = await res.json(); 
        };
        
        const createQuiz = async () => { 
            if (newQuiz.time_duration < 3 || newQuiz.time_duration > 30) { 
                showModal('Invalid Time', 'A quiz must be between 3 and 30 minutes long.', 'danger'); 
                return; 
            } 
            const res = await fetch(`/api/admin/chapters/${selectedChapter.value.id}/quizzes`, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(newQuiz)
            }); 
            if(res.ok) { 
                showModal('Success', 'Quiz Added!', 'success'); 
                quizzes.value.push((await res.json()).quiz); 
                newQuiz.remarks = ''; 
                newQuiz.date_of_quiz = ''; 
                newQuiz.time_duration = 30; 
            } 
        };
        
        const viewQuestions = async (q) => { 
            selectedQuiz.value = q; 
            const res = await fetch(`/api/admin/quizzes/${q.id}/questions`); 
            if(res.ok) questions.value = await res.json(); 
        };
        
        const createQuestion = async () => { 
            const res = await fetch(`/api/admin/quizzes/${selectedQuiz.value.id}/questions`, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(newQuestion)
            }); 
            if(res.ok) { 
                showModal('Success', 'Question Added!', 'success'); 
                questions.value.push((await res.json()).question); 
                newQuestion.question_statement = ''; 
                newQuestion.option1 = ''; 
                newQuestion.option2 = ''; 
                newQuestion.option3 = ''; 
                newQuestion.option4 = ''; 
            } 
        };

        // --- Delete & Back Navigation ---
        const deleteItem = (type, id) => { 
            showModal('Delete?', `Delete this ${type}?`, 'danger', async () => { 
                try { 
                    const endpoint = type === 'quiz' ? 'quizzes' : type + 's'; 
                    const res = await fetch(`/api/admin/${endpoint}/${id}`, { method: 'DELETE' }); 
                    
                    if (res.ok) { 
                        showModal('Deleted', 'Removed successfully.', 'success'); 
                        if (type === 'subject') fetchSubjects(); 
                        if (type === 'chapter') viewChapters(selectedSubject.value); 
                        if (type === 'quiz') viewQuizzes(selectedChapter.value); 
                        if (type === 'question') viewQuestions(selectedQuiz.value); 
                        if (type === 'student') searchStudents(); 
                    } 
                } catch(e) { 
                    showModal('Error', 'Delete failed', 'danger'); 
                } 
            }); 
        };

        const goBackToSubjects = () => { selectedSubject.value = null; }; 
        const goBackToChapters = () => { selectedChapter.value = null; }; 
        const goBackToQuizzes = () => { selectedQuiz.value = null; };

        // --- Edit Content Logic ---
        const editContext = reactive({ isVisible: false, type: '', id: null, payload: {} });
        
        const openEditModal = (type, item) => { 
            editContext.type = type; 
            editContext.id = item.id; 
            editContext.payload = JSON.parse(JSON.stringify(item)); 
            editContext.isVisible = true; 
        };
        
        const closeEditModal = () => { editContext.isVisible = false; };
        
        const saveEdit = async () => { 
            if (editContext.type === 'quiz') {
                if (editContext.payload.time_duration < 3 || editContext.payload.time_duration > 30) {
                    showModal('Invalid Time', 'A quiz must be between 3 and 30 minutes long.', 'danger');
                    return;
                }
            }

            try { 
                const endpoint = editContext.type === 'quiz' ? 'quizzes' : editContext.type + 's'; 
                const res = await fetch(`/api/admin/${endpoint}/${editContext.id}`, { 
                    method: 'PUT', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(editContext.payload) 
                }); 
                
                if (res.ok) { 
                    showModal('Success', 'Updated successfully.', 'success'); 
                    closeEditModal(); 
                    if (editContext.type === 'subject') fetchSubjects(); 
                    if (editContext.type === 'chapter') viewChapters(selectedSubject.value); 
                    if (editContext.type === 'quiz') viewQuizzes(selectedChapter.value); 
                    if (editContext.type === 'question') viewQuestions(selectedQuiz.value); 
                    if (editContext.type === 'student') searchStudents(); 
                } else { 
                    showModal('Error', 'Failed to update.', 'danger'); 
                } 
            } catch (e) { 
                showModal('Error', 'Network error.', 'danger'); 
            } 
        };

        // ==========================================
        // 5. ADMIN ANALYTICS
        // ==========================================
        const analyticsTab = ref('quiz'); 
        const allQuizzes = ref([]); 
        const selectedAnalyticsQuiz = ref(null); 
        const studentSearchQuery = ref(""); 
        const studentSearchResults = ref([]); 
        const selectedStudentStats = ref(null);
        const quizSearchQuery = ref("");

        // Analytics Quiz Search Filter
        const filteredAllQuizzes = computed(() => {
            if (!quizSearchQuery.value) return allQuizzes.value;
            return allQuizzes.value.filter(q => 
                q.remarks.toLowerCase().includes(quizSearchQuery.value.toLowerCase()) || 
                q.subject_name.toLowerCase().includes(quizSearchQuery.value.toLowerCase())
            );
        });

        watch(analyticsTab, (newTab) => {
            if (newTab === 'quiz' && selectedAnalyticsQuiz.value) { 
                nextTick(() => renderAdminQuizCharts()); 
            } 
            else if (newTab === 'student' && selectedStudentStats.value) { 
                nextTick(() => renderAdminStudentCharts()); 
            }
        });

        const fetchAnalyticsQuizzes = async () => { 
            try { 
                const res = await fetch('/api/admin/analytics/quizzes'); 
                if(res.ok) allQuizzes.value = await res.json(); 
            } catch(e){} 
        };
        
        const viewQuizAnalytics = async (quizId) => { 
            try { 
                const res = await fetch(`/api/admin/analytics/quiz/${quizId}`); 
                if (res.ok) { 
                    selectedAnalyticsQuiz.value = await res.json(); 
                    nextTick(() => renderAdminQuizCharts()); 
                } 
            } catch(e){} 
        };
        
        const searchStudents = async () => { 
            if (!studentSearchQuery.value) return; 
            try { 
                const res = await fetch(`/api/admin/analytics/students/search?q=${studentSearchQuery.value}`); 
                if (res.ok) studentSearchResults.value = await res.json(); 
            } catch(e){} 
        };
        
        const viewStudentAnalytics = async (studentId) => { 
            try { 
                const res = await fetch(`/api/admin/analytics/student/${studentId}`); 
                if (res.ok) { 
                    selectedStudentStats.value = await res.json(); 
                    nextTick(() => renderAdminStudentCharts()); 
                } 
            } catch(e){} 
        };

        let adminChartInstances = {};
        const renderAdminQuizCharts = () => {
            const ctxDist = document.getElementById('scoreDistChart');
            const ctxAtt = document.getElementById('attendanceChart');
            if (!ctxDist || !selectedAnalyticsQuiz.value) return;
            
            if (adminChartInstances.dist) adminChartInstances.dist.destroy();
            if (adminChartInstances.att) adminChartInstances.att.destroy();
            
            adminChartInstances.dist = new Chart(ctxDist, { 
                type: 'bar', 
                data: { 
                    labels: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'], 
                    datasets: [{ label: 'Students', data: selectedAnalyticsQuiz.value.score_distribution, backgroundColor: '#0d6efd' }] 
                }, 
                options: { responsive: true, maintainAspectRatio: false } 
            });
            
            adminChartInstances.att = new Chart(ctxAtt, { 
                type: 'doughnut', 
                data: { 
                    labels: ['Attended', 'Missed', 'Pending'], 
                    datasets: [{ data: [selectedAnalyticsQuiz.value.stats.attended, selectedAnalyticsQuiz.value.stats.missed, selectedAnalyticsQuiz.value.stats.pending], backgroundColor: ['#198754', '#dc3545', '#ffc107'] }] 
                }, 
                options: { responsive: true, maintainAspectRatio: false } 
            });
        };

        const renderAdminStudentCharts = () => {
            const ctxPerf = document.getElementById('studentPerfChart');
            if (!ctxPerf || !selectedStudentStats.value) return;
            
            if (adminChartInstances.perf) adminChartInstances.perf.destroy();
            
            adminChartInstances.perf = new Chart(ctxPerf, { 
                type: 'line', 
                data: { 
                    labels: selectedStudentStats.value.history.map(h => h.quiz_name), 
                    datasets: [{ label: 'Score (%)', data: selectedStudentStats.value.history.map(h => h.percentage), borderColor: '#6610f2', fill: true, backgroundColor: 'rgba(102, 16, 242, 0.1)', tension: 0.3 }] 
                }, 
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } } 
            });
        };

        // ==========================================
        // 6. STUDENT DASHBOARD
        // ==========================================
        const studentQuizzes = ref([]); 
        const userScores = ref([]); 
        const currentView = ref('quizzes'); 
        const activeQuiz = ref(null); 
        const activeQuestions = ref([]); 
        const userAnswers = reactive({});
        
        const profileData = reactive({ full_name: '', email: '', qualification: '', dob: '', new_password: '' });
        
        const fetchUserProfile = async () => { 
            try { 
                const res = await fetch('/api/user/profile'); 
                if (res.ok) { 
                    const data = await res.json(); 
                    user.created_at = data.created_at; 
                    profileData.full_name = data.full_name; 
                    profileData.email = data.email; 
                    profileData.qualification = data.qualification; 
                    profileData.dob = data.dob; 
                } 
            } catch(e) {} 
        };
        
        const saveUserProfile = async () => { 
            try { 
                const res = await fetch('/api/user/profile', { 
                    method: 'PUT', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(profileData) 
                }); 
                const data = await res.json(); 
                if (res.ok) { 
                    showModal('Success', 'Profile updated!', 'success'); 
                    user.full_name = data.full_name; 
                    user.qualification = data.qualification; 
                    localStorage.setItem('user_name', data.full_name); 
                    localStorage.setItem('user_qual', data.qualification); 
                    profileData.new_password = ''; 
                } else { 
                    showModal('Error', 'Update failed.', 'danger'); 
                } 
            } catch(e) {} 
        };

        // --- Quiz Timer Logic ---
        const timeRemaining = ref(0); 
        let timerInterval = null;
        
        const formattedTime = computed(() => { 
            const m = Math.floor(timeRemaining.value / 60); 
            const s = timeRemaining.value % 60; 
            return `${m}:${s < 10 ? '0' : ''}${s}`; 
        });
        
        const startTimer = (minutes) => { 
            timeRemaining.value = minutes * 60; 
            clearInterval(timerInterval); 
            timerInterval = setInterval(() => { 
                timeRemaining.value--; 
                if (timeRemaining.value <= 0) { 
                    clearInterval(timerInterval); 
                    submitQuiz(true); 
                } 
            }, 1000); 
        };
        
        const stopTimer = () => { clearInterval(timerInterval); };

        const fetchStudentQuizzes = async () => { 
            try { 
                const res = await fetch('/api/user/quizzes'); 
                if(res.ok) studentQuizzes.value = await res.json(); 
            } catch(e){} 
        };
        
        const fetchUserScores = async () => { 
            try { 
                const res = await fetch('/api/user/scores'); 
                if(res.ok) userScores.value = await res.json(); 
            } catch(e){} 
        };

        const todayStr = new Date().toISOString().split('T')[0];
        
        const upcomingQuizzes = computed(() => { 
            const attemptedIds = userScores.value.map(s => s.quiz_id); 
            return studentQuizzes.value.filter(q => !attemptedIds.includes(q.id) && q.date_of_quiz >= todayStr); 
        });
        
        const missedQuizzes = computed(() => { 
            const attemptedIds = userScores.value.map(s => s.quiz_id); 
            return studentQuizzes.value.filter(q => !attemptedIds.includes(q.id) && q.date_of_quiz < todayStr && q.date_of_quiz >= user.created_at); 
        });
        
        const completedQuizzes = computed(() => { 
            const attemptedIds = userScores.value.map(s => s.quiz_id); 
            return studentQuizzes.value.filter(q => attemptedIds.includes(q.id)); 
        });

        const userStats = computed(() => { 
            const scores = userScores.value; 
            if (scores.length === 0) return { total: 0, avg: 0 }; 
            const sum = scores.reduce((acc, s) => acc + (s.score / s.total_questions * 100), 0); 
            return { total: scores.length, avg: Math.round(sum / scores.length) }; 
        });

        const switchView = (view) => { 
            currentView.value = view; 
            if (view === 'quizzes') fetchStudentQuizzes(); 
            if (view === 'scores') fetchUserScores().then(() => nextTick(() => renderUserCharts())); 
        };

        const startQuiz = async (quizId) => { 
            try { 
                const res = await fetch(`/api/user/quiz/${quizId}`); 
                if (res.ok) { 
                    const data = await res.json(); 
                    activeQuiz.value = data.quiz; 
                    activeQuestions.value = data.questions; 
                    for (const key in userAnswers) delete userAnswers[key]; 
                    currentView.value = 'playing'; 
                    startTimer(activeQuiz.value.time_duration); 
                } 
            } catch (e) { 
                showModal('Error', 'Failed to load quiz.', 'danger'); 
            } 
        };
        
        const cancelQuiz = () => { 
            showModal('Quit?', 'Progress lost.', 'danger', () => { 
                stopTimer(); 
                currentView.value = 'quizzes'; 
                activeQuiz.value = null; 
            }); 
        };

        const submitQuiz = (autoSubmit = false) => { 
            const performSubmission = async () => { 
                stopTimer(); 
                try { 
                    const res = await fetch(`/api/user/quiz/${activeQuiz.value.id}/submit`, { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ answers: userAnswers }) 
                    }); 
                    const data = await res.json(); 
                    if (res.ok) { 
                        showModal('Result', `Score: ${data.score}`, 'success', () => { fetchUserScores().then(() => switchView('scores')); }); 
                    } 
                } catch (e) {} 
            }; 
            
            if (autoSubmit === true) { 
                showModal('Time is Up!', 'Your quiz has been automatically submitted.', 'warning', performSubmission); 
            } else { 
                showModal('Submit?', 'Are you sure you want to submit your answers?', 'primary', performSubmission); 
            } 
        };

        const triggerExport = async () => { 
            showModal('Processing', 'Generating CSV...', 'info'); 
            try { 
                const res = await fetch('/api/user/export', { method: 'POST' }); 
                const data = await res.json(); 
                if (res.ok) { 
                    showModal('Success', 'Report ready!', 'success', () => { window.location.href = `/api/user/download-csv/${data.job_id}`; }); 
                } 
            } catch (e) {} 
        };

        let userChartInstances = {};
        const renderUserCharts = () => { 
            const ctxTrend = document.getElementById('trendChart'); 
            const ctxPie = document.getElementById('masteryPie'); 
            const ctxImprove = document.getElementById('improvementChart'); 
            if (!ctxTrend || userScores.value.length === 0) return; 
            
            Object.values(userChartInstances).forEach(c => c.destroy()); 
            
            const subjectsMap = {}; 
            userScores.value.forEach(s => { 
                if (!subjectsMap[s.subject_name]) subjectsMap[s.subject_name] = { score: 0, total: 0, count: 0 }; 
                subjectsMap[s.subject_name].score += s.score; 
                subjectsMap[s.subject_name].total += s.total_questions; 
                subjectsMap[s.subject_name].count++; 
            }); 
            const subLabels = Object.keys(subjectsMap); 
            
            userChartInstances.trend = new Chart(ctxTrend, { type: 'line', data: { labels: userScores.value.map(s => s.quiz_remarks), datasets: [{ label: 'Score (%)', data: userScores.value.map(s => (s.score / s.total_questions) * 100), borderColor: '#0d6efd', fill: true, backgroundColor: 'rgba(13, 110, 253, 0.1)', tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } } }); 
            userChartInstances.pie = new Chart(ctxPie, { type: 'doughnut', data: { labels: subLabels, datasets: [{ data: subLabels.map(l => subjectsMap[l].count), backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6610f2'] }] }, options: { responsive: true, maintainAspectRatio: false } }); 
            userChartInstances.improve = new Chart(ctxImprove, { type: 'bar', data: { labels: subLabels, datasets: [ { label: 'Current %', data: subLabels.map(l => (subjectsMap[l].score/subjectsMap[l].total)*100), backgroundColor: '#198754' }, { label: 'Gap to 100%', data: subLabels.map(l => 100 - (subjectsMap[l].score/subjectsMap[l].total)*100), backgroundColor: '#e9ecef' } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, max: 100 } } } }); 
        };

        const loadDashboard = async () => { 
            if (user.role === 'admin') { 
                fetchSubjects(); 
                fetchAnalyticsQuizzes(); 
            } 
            if (user.role === 'user') { 
                await fetchUserProfile(); 
                fetchStudentQuizzes(); 
                fetchUserScores(); 
            } 
        };

        onMounted(() => { if (user.isAuthenticated) loadDashboard(); });

        return { 
            user, credentials, isRegistering, toggleAuthMode, authAction, logout,
            subjects, newSubject, createSubject, deleteItem, selectedSubject, chapters, newChapter, viewChapters, createChapter, goBackToSubjects, selectedChapter, quizzes, newQuiz, viewQuizzes, createQuiz, goBackToChapters, selectedQuiz, questions, newQuestion, viewQuestions, createQuestion, goBackToQuizzes,
            adminView, analyticsTab, allQuizzes, selectedAnalyticsQuiz, viewQuizAnalytics, studentSearchQuery, studentSearchResults, searchStudents, selectedStudentStats, viewStudentAnalytics, quizSearchQuery, filteredAllQuizzes,
            studentQuizzes, userScores, currentView, switchView, startQuiz, activeQuiz, activeQuestions, userAnswers, submitQuiz, cancelQuiz, triggerExport,
            modal, closeModal, confirmAction, searchQuery, filteredSubjects, userStats, upcomingQuizzes, missedQuizzes, completedQuizzes,
            timeRemaining, formattedTime, editContext, openEditModal, closeEditModal, saveEdit, profileData, saveUserProfile,
            notifications, showNotifModal, openNotifications, closeNotifModal
        };
    },
    template: `
        <div class="d-flex flex-column min-vh-100 bg-light">
            
            <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow py-3">
                <div class="container">
                    <span class="navbar-brand fw-bold fs-4 mb-0" style="letter-spacing: 1px;">
                        Quizzo<span class="text-primary">.</span>
                    </span>
                    
                    <div class="d-flex align-items-center" v-if="user.isAuthenticated">
                        <button @click="openNotifications" class="btn btn-outline-light btn-sm me-3 position-relative rounded-pill px-3 shadow-sm">
                            Alerts
                        </button>
                        <span class="text-light me-4 small d-none d-md-block opacity-75">
                            {{ user.email }} <span class="badge bg-secondary ms-1 text-uppercase">{{ user.role }}</span>
                        </span>
                        <button @click="logout" class="btn btn-danger btn-sm rounded-pill px-4 fw-bold shadow-sm">Logout</button>
                    </div>
                </div>
            </nav>

            <main class="container flex-grow-1 py-5">
                
                <div v-if="!user.isAuthenticated" class="row justify-content-center">
                    <div class="col-md-5">
                        <div class="card shadow-lg border-0 rounded-4 overflow-hidden mt-4">
                            <div class="card-header bg-primary text-white text-center py-4 border-0">
                                <h4 class="mb-0 fw-bold">{{ isRegistering ? 'Create Account' : 'Welcome to Quizzo' }}</h4>
                                <small class="opacity-75">Please login to continue</small>
                            </div>
                            <div class="card-body p-4 p-md-5">
                                <form @submit.prevent="authAction">
                                    <div class="mb-3">
                                        <label class="small fw-bold text-muted mb-1">Email Address</label>
                                        <input v-model="credentials.email" type="email" class="form-control form-control-lg shadow-none bg-light border-0" required>
                                    </div>
                                    <div class="mb-4">
                                        <label class="small fw-bold text-muted mb-1">Password</label>
                                        <input v-model="credentials.password" type="password" class="form-control form-control-lg shadow-none bg-light border-0" required>
                                    </div>
                                    <div v-if="isRegistering">
                                        <div class="mb-3">
                                            <label class="small fw-bold text-muted mb-1">Name</label>
                                            <input v-model="credentials.full_name" class="form-control form-control-lg shadow-none bg-light border-0" required>
                                        </div>
                                        <div class="mb-3">
                                            <label class="small fw-bold text-muted mb-1">Qualification</label>
                                            <input v-model="credentials.qualification" class="form-control form-control-lg shadow-none bg-light border-0">
                                        </div>
                                        <div class="mb-4">
                                            <label class="small fw-bold text-muted mb-1">DOB</label>
                                            <input v-model="credentials.dob" type="date" class="form-control form-control-lg shadow-none bg-light border-0">
                                        </div>
                                    </div>
                                    <button class="btn btn-primary btn-lg w-100 mb-3 rounded-pill fw-bold shadow-sm">{{ isRegistering ? 'Register Securely' : 'Login Securely' }}</button>
                                    <div class="text-center small">
                                        <a href="#" class="text-decoration-none text-muted" @click.prevent="toggleAuthMode">{{ isRegistering ? 'Already have an account? Login' : 'New here? Create Account' }}</a>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-else>
                    
                    <div v-if="user.role === 'admin'">
                        <div class="d-flex mb-4">
                            <button class="btn me-2 px-4 shadow-sm rounded-pill" :class="adminView === 'manage' ? 'btn-dark' : 'btn-outline-dark'" @click="adminView = 'manage'">Manage Content</button>
                            <button class="btn px-4 shadow-sm rounded-pill" :class="adminView === 'analytics' ? 'btn-dark' : 'btn-outline-dark'" @click="adminView = 'analytics'; fetchAnalyticsQuizzes();">Analytics & Reports</button>
                        </div>

                        <div v-if="adminView === 'manage'">
                            <div v-if="!selectedSubject" class="row">
                                <div class="col-md-4">
                                    <div class="card p-4 shadow-sm mb-3 border-0 bg-white rounded-4">
                                        <h5>Add Subject</h5>
                                        <form @submit.prevent="createSubject">
                                            <input v-model="newSubject.name" class="form-control mb-3 bg-light border-0" placeholder="Subject Name" required>
                                            <button class="btn btn-success w-100 rounded-pill fw-bold">Create</button>
                                        </form>
                                    </div>
                                </div>
                                <div class="col-md-8">
                                    <div class="card shadow-sm border-0 rounded-4">
                                        <div class="card-header bg-white border-bottom-0 pt-4 pb-0">
                                            <div class="d-flex justify-content-between align-items-center mb-3">
                                                <h5 class="mb-0 fw-bold">Active Subjects</h5>
                                                <input v-model="searchQuery" type="text" class="form-control form-control-sm w-50 bg-light border-0 shadow-none rounded-pill px-3" placeholder="Search subjects...">
                                            </div>
                                        </div>
                                        <ul class="list-group list-group-flush pb-2">
                                            <li v-for="sub in filteredSubjects" :key="sub.id" class="list-group-item d-flex justify-content-between align-items-center py-3 border-0 border-bottom">
                                                <span>{{ sub.name }}</span>
                                                <div>
                                                    <button @click="viewChapters(sub)" class="btn btn-sm btn-primary me-2 rounded-pill px-3 shadow-sm">Manage</button>
                                                    <button @click="openEditModal('subject', sub)" class="btn btn-sm btn-outline-secondary me-2 rounded-pill px-3">Edit</button>
                                                    <button @click="deleteItem('subject', sub.id)" class="btn btn-sm btn-outline-danger rounded-pill px-3">Delete</button>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div v-else-if="!selectedChapter" class="row">
                                <div class="col-12 mb-4 d-flex align-items-center">
                                    <button @click="goBackToSubjects" class="btn btn-secondary btn-sm me-3 rounded-pill px-3 shadow-sm">Back</button> 
                                    <h3 class="mb-0 fw-bold">{{ selectedSubject.name }}</h3>
                                </div>
                                <div class="col-md-4">
                                    <div class="card p-4 border-0 bg-white shadow-sm rounded-4">
                                        <h5>Add Chapter</h5>
                                        <form @submit.prevent="createChapter">
                                            <input v-model="newChapter.name" class="form-control mb-3 bg-light border-0" placeholder="Chapter Name" required>
                                            <button class="btn btn-success w-100 rounded-pill fw-bold">Add Chapter</button>
                                        </form>
                                    </div>
                                </div>
                                <div class="col-md-8">
                                    <div class="list-group shadow-sm rounded-4">
                                        <div v-for="c in chapters" :key="c.id" class="list-group-item d-flex justify-content-between align-items-center py-3 border-0 border-bottom">
                                            <span class="fw-bold">{{ c.name }}</span>
                                            <div>
                                                <button @click="viewQuizzes(c)" class="btn btn-sm btn-info text-white me-2 rounded-pill px-3 shadow-sm">Quizzes</button>
                                                <button @click="openEditModal('chapter', c)" class="btn btn-sm btn-outline-secondary me-2 rounded-pill px-3">Edit</button>
                                                <button @click="deleteItem('chapter', c.id)" class="btn btn-sm btn-outline-danger rounded-pill px-3">Delete</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-else-if="!selectedQuiz" class="row">
                                <div class="col-12 mb-4 d-flex align-items-center">
                                    <button @click="goBackToChapters" class="btn btn-secondary btn-sm me-3 rounded-pill px-3 shadow-sm">Back</button> 
                                    <h3 class="mb-0 fw-bold">{{ selectedChapter.name }}</h3>
                                </div>
                                <div class="col-md-4">
                                    <div class="card p-4 border-0 bg-white shadow-sm rounded-4">
                                        <h5>Add Quiz</h5>
                                        <form @submit.prevent="createQuiz">
                                            <input v-model="newQuiz.remarks" class="form-control mb-2 bg-light border-0" placeholder="Quiz Title" required>
                                            <input v-model="newQuiz.date_of_quiz" type="date" class="form-control mb-2 bg-light border-0" required>
                                            <input v-model="newQuiz.time_duration" type="number" min="3" max="30" class="form-control mb-3 bg-light border-0" placeholder="Mins (3-30)" required>
                                            <button class="btn btn-success w-100 rounded-pill fw-bold">Add Quiz</button>
                                        </form>
                                    </div>
                                </div>
                                <div class="col-md-8">
                                    <div class="list-group shadow-sm rounded-4">
                                        <div v-for="q in quizzes" :key="q.id" class="list-group-item d-flex justify-content-between align-items-center py-3 border-0 border-bottom">
                                            <span>
                                                <strong class="d-block">{{ q.remarks }}</strong>
                                                <small class="text-muted">{{ q.time_duration }} mins | {{ q.date_of_quiz }}</small>
                                            </span>
                                            <div>
                                                <button @click="viewQuestions(q)" class="btn btn-sm btn-warning me-2 rounded-pill px-3 shadow-sm">Questions</button>
                                                <button @click="openEditModal('quiz', q)" class="btn btn-sm btn-outline-secondary me-2 rounded-pill px-3">Edit</button>
                                                <button @click="deleteItem('quiz', q.id)" class="btn btn-sm btn-outline-danger rounded-pill px-3">Delete</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="row">
                                <div class="col-12 mb-4 d-flex align-items-center">
                                    <button @click="goBackToQuizzes" class="btn btn-secondary btn-sm me-3 rounded-pill px-3 shadow-sm">Back</button> 
                                    <h3 class="mb-0 fw-bold">Questions Editor</h3>
                                </div>
                                <div class="col-md-5">
                                    <div class="card p-4 border-0 bg-white shadow-sm rounded-4">
                                        <h5>Add Question</h5>
                                        <form @submit.prevent="createQuestion">
                                            <textarea v-model="newQuestion.question_statement" class="form-control mb-3 bg-light border-0" placeholder="Question Statement..." required></textarea>
                                            <div class="row g-2 mb-2">
                                                <div class="col-6"><input v-model="newQuestion.option1" class="form-control form-control-sm bg-light border-0 py-2" placeholder="Option 1" required></div>
                                                <div class="col-6"><input v-model="newQuestion.option2" class="form-control form-control-sm bg-light border-0 py-2" placeholder="Option 2" required></div>
                                                <div class="col-6"><input v-model="newQuestion.option3" class="form-control form-control-sm bg-light border-0 py-2" placeholder="Option 3" required></div>
                                                <div class="col-6"><input v-model="newQuestion.option4" class="form-control form-control-sm bg-light border-0 py-2" placeholder="Option 4" required></div>
                                            </div>
                                            <label class="small text-muted fw-bold mt-2">Correct Answer (1-4)</label>
                                            <input v-model="newQuestion.correct_option" type="number" min="1" max="4" class="form-control mb-4 bg-light border-0" required>
                                            <button class="btn btn-success w-100 rounded-pill fw-bold shadow-sm">Save Question</button>
                                        </form>
                                    </div>
                                </div>
                                <div class="col-md-7">
                                    <div class="list-group shadow-sm rounded-4">
                                        <div v-for="(q, index) in questions" class="list-group-item d-flex justify-content-between py-3 border-0 border-bottom">
                                            <div>
                                                <span class="fw-bold me-2">Q{{ index + 1 }}.</span> {{ q.question_statement }} <br>
                                                <small class="text-success fw-bold ms-4">Ans: Option {{ q.correct_option }}</small>
                                            </div>
                                            <div>
                                                <button @click="openEditModal('question', q)" class="btn btn-sm btn-outline-secondary me-2 rounded-pill px-3">Edit</button>
                                                <button @click="deleteItem('question', q.id)" class="btn btn-sm btn-outline-danger rounded-pill px-3">Delete</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="adminView === 'analytics'">
                            <div class="card shadow-sm border-0 mb-3 rounded-4 overflow-hidden">
                                <div class="card-header bg-white border-bottom-0 pt-3 pb-0">
                                    <ul class="nav nav-tabs card-header-tabs fw-bold">
                                        <li class="nav-item">
                                            <a class="nav-link px-4" :class="analyticsTab === 'quiz' ? 'active text-primary border-bottom-0' : 'text-muted border-0'" href="#" @click.prevent="analyticsTab = 'quiz'">Quiz Reports</a>
                                        </li>
                                        <li class="nav-item">
                                            <a class="nav-link px-4" :class="analyticsTab === 'student' ? 'active text-primary border-bottom-0' : 'text-muted border-0'" href="#" @click.prevent="analyticsTab = 'student'">Student Insights</a>
                                        </li>
                                    </ul>
                                </div>
                                <div class="card-body p-4 bg-light">
                                    <div v-if="analyticsTab === 'quiz'">
                                        <div v-if="!selectedAnalyticsQuiz">
                                            <div class="d-flex justify-content-between align-items-center mb-4">
                                                <h5 class="mb-0 fw-bold">Platform Overview</h5>
                                                <input v-model="quizSearchQuery" type="text" class="form-control w-50 bg-white border-0 shadow-sm rounded-pill px-4" placeholder="Search quizzes by title or subject...">
                                            </div>
                                            <div class="card border-0 shadow-sm rounded-4">
                                                <table class="table table-hover mb-0">
                                                    <thead>
                                                        <tr class="bg-light text-muted small text-uppercase">
                                                            <th>Quiz Title</th><th>Subject</th><th>Chapter</th><th>Date</th><th>Status</th><th>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr v-for="q in filteredAllQuizzes" :key="q.id">
                                                            <td><strong class="text-dark">{{ q.remarks }}</strong></td>
                                                            <td>{{ q.subject_name }}</td>
                                                            <td class="text-muted">{{ q.chapter_name }}</td>
                                                            <td>{{ q.date_of_quiz }}</td>
                                                            <td><span class="badge rounded-pill" :class="q.status === 'Completed' ? 'bg-success' : (q.status === 'Active' ? 'bg-primary' : 'bg-warning')">{{ q.status }}</span></td>
                                                            <td><button class="btn btn-sm btn-outline-primary rounded-pill px-3" @click="viewQuizAnalytics(q.id)">View Report</button></td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        <div v-else>
                                            <button class="btn btn-sm btn-secondary mb-4 rounded-pill px-4 shadow-sm" @click="selectedAnalyticsQuiz = null">Back to Reports</button>
                                            <h4 class="mb-4 fw-bold">{{ selectedAnalyticsQuiz.quiz_title }} Analysis</h4>
                                            <div class="row mb-4">
                                                <div class="col-md-6">
                                                    <div class="card shadow-sm h-100 border-0 rounded-4">
                                                        <div class="card-header bg-white fw-bold pt-3 border-0">Attendance Rate</div>
                                                        <div class="card-body"><div style="height:200px"><canvas id="attendanceChart"></canvas></div></div>
                                                    </div>
                                                </div>
                                                <div class="col-md-6">
                                                    <div class="card shadow-sm h-100 border-0 rounded-4">
                                                        <div class="card-header bg-white fw-bold pt-3 border-0">Score Distribution</div>
                                                        <div class="card-body"><div style="height:200px"><canvas id="scoreDistChart"></canvas></div></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="card shadow-sm border-0 rounded-4 overflow-hidden">
                                                <div class="card-header bg-white fw-bold py-3 border-0">Detailed Student Register</div>
                                                <table class="table mb-0 table-hover">
                                                    <thead><tr class="bg-light text-muted small text-uppercase"><th>Name</th><th>Email</th><th>Status</th><th>Score</th></tr></thead>
                                                    <tbody>
                                                        <tr v-for="s in selectedAnalyticsQuiz.students" :key="s.id">
                                                            <td><strong class="text-dark">{{ s.name }}</strong></td>
                                                            <td>{{ s.email }}</td>
                                                            <td><span class="badge rounded-pill" :class="s.status === 'Attended' ? 'bg-success' : (s.status === 'Missed' ? 'bg-danger' : 'bg-warning text-dark')">{{ s.status }}</span></td>
                                                            <td><strong>{{ s.score }}</strong></td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div v-if="analyticsTab === 'student'">
                                        <div v-if="!selectedStudentStats">
                                            <div class="card bg-white p-4 mb-4 border-0 shadow-sm rounded-4">
                                                <div class="input-group">
                                                    <input v-model="studentSearchQuery" type="text" class="form-control form-control-lg bg-light border-0 shadow-none" placeholder="Search by student name or email...">
                                                    <button class="btn btn-primary px-4 fw-bold rounded-end" @click="searchStudents">Search Directory</button>
                                                </div>
                                            </div>
                                            <div v-if="studentSearchResults.length > 0" class="card shadow-sm border-0 rounded-4">
                                                <div class="card-header bg-white fw-bold py-3 border-0">Search Results</div>
                                                <div class="list-group list-group-flush">
                                                    <div v-for="s in studentSearchResults" :key="s.id" class="list-group-item d-flex justify-content-between align-items-center py-3">
                                                        <div class="d-flex flex-column">
                                                            <strong class="text-dark fs-5">{{ s.full_name }}</strong> 
                                                            <small class="text-muted">{{ s.email }}</small>
                                                        </div>
                                                        <div>
                                                            <button class="btn btn-sm btn-outline-secondary me-2 rounded-pill px-3" @click="openEditModal('student', s)">Edit Details</button>
                                                            <button class="btn btn-sm btn-outline-danger me-2 rounded-pill px-3" @click="deleteItem('student', s.id)">Wipe & Delete</button>
                                                            <button class="btn btn-sm btn-primary rounded-pill px-3 shadow-sm" @click="viewStudentAnalytics(s.id)">View Full Profile</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-else>
                                            <button class="btn btn-sm btn-secondary mb-4 rounded-pill px-4 shadow-sm" @click="selectedStudentStats = null">Back to Directory</button>
                                            <div class="row mb-4">
                                                <div class="col-md-4">
                                                    <div class="card bg-primary text-white p-4 rounded-4 shadow-sm border-0">
                                                        <h2 class="fw-bold mb-0">{{ selectedStudentStats.total_quizzes }}</h2>
                                                        <small class="opacity-75 text-uppercase fw-bold">Quizzes Taken</small>
                                                    </div>
                                                </div>
                                                <div class="col-md-4">
                                                    <div class="card bg-success text-white p-4 rounded-4 shadow-sm border-0">
                                                        <h2 class="fw-bold mb-0">{{ selectedStudentStats.avg_score }}%</h2>
                                                        <small class="opacity-75 text-uppercase fw-bold">Average Score</small>
                                                    </div>
                                                </div>
                                                <div class="col-md-4">
                                                    <div class="card bg-danger text-white p-4 rounded-4 shadow-sm border-0">
                                                        <h2 class="fw-bold mb-0">{{ selectedStudentStats.missed_quizzes }}</h2>
                                                        <small class="opacity-75 text-uppercase fw-bold">Missed Quizzes</small>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="card shadow-sm mb-4 border-0 rounded-4">
                                                <div class="card-header bg-white fw-bold py-3 border-0">Historical Performance Trend</div>
                                                <div class="card-body"><div style="height:250px"><canvas id="studentPerfChart"></canvas></div></div>
                                            </div>
                                            <div class="card shadow-sm border-0 rounded-4 overflow-hidden">
                                                <div class="card-header bg-white fw-bold py-3 border-0">Complete Exam History</div>
                                                <table class="table mb-0 table-hover">
                                                    <thead><tr class="bg-light text-muted small text-uppercase"><th>Quiz Title</th><th>Final Score</th><th>Attendance Status</th></tr></thead>
                                                    <tbody>
                                                        <tr v-for="h in selectedStudentStats.history" :key="h.quiz_id">
                                                            <td><strong class="text-dark">{{ h.quiz_name }}</strong></td>
                                                            <td>{{ h.score }}</td>
                                                            <td><span class="badge rounded-pill" :class="h.status === 'Attended' ? 'bg-success' : 'bg-danger'">{{ h.status }}</span></td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="user.role === 'user'">
                        <div class="row">
                            <div class="col-md-9">
                                 
                                 <div v-if="currentView !== 'playing'" class="row mb-4">
                                    <div class="col-md-7">
                                        <div class="card bg-primary text-white shadow-sm h-100 border-0 rounded-4 pattern-bg">
                                            <div class="card-body p-4 d-flex flex-column justify-content-center">
                                                <h3 class="fw-bold mb-1">Hello, {{ user.full_name }}!</h3>
                                                <p class="mb-0 opacity-75 fs-6">{{ user.qualification }}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-2 text-center">
                                        <div class="card shadow-sm border-0 h-100 rounded-4 bg-white">
                                            <div class="card-body d-flex flex-column justify-content-center py-4">
                                                <h2 class="fw-bold text-dark mb-0">{{ userStats.total }}</h2>
                                                <small class="text-muted text-uppercase fw-bold" style="font-size: 0.7rem;">Attempts</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-3 text-center">
                                        <div class="card shadow-sm border-0 h-100 rounded-4 bg-white">
                                            <div class="card-body d-flex flex-column justify-content-center py-4">
                                                <h2 class="fw-bold text-success mb-0">{{ userStats.avg }}%</h2>
                                                <small class="text-muted text-uppercase fw-bold" style="font-size: 0.7rem;">Overall Avg</small>
                                            </div>
                                        </div>
                                    </div>
                                 </div>
                                 
                                 <div v-if="currentView !== 'playing'" class="mb-4 d-flex justify-content-between align-items-center bg-white p-2 rounded-pill shadow-sm border">
                                    <div>
                                        <button class="btn me-1 px-4 rounded-pill fw-bold" :class="currentView === 'quizzes' ? 'btn-dark' : 'btn-light text-muted'" @click="switchView('quizzes')">Practice Quizzes</button>
                                        <button class="btn me-1 px-4 rounded-pill fw-bold" :class="currentView === 'scores' ? 'btn-dark' : 'btn-light text-muted'" @click="switchView('scores')">Performance Lab</button>
                                        <button class="btn px-4 rounded-pill fw-bold" :class="currentView === 'profile' ? 'btn-dark' : 'btn-light text-muted'" @click="switchView('profile')">Profile Settings</button>
                                    </div>
                                    <button v-if="currentView === 'scores'" @click="triggerExport" class="btn btn-outline-success btn-sm rounded-pill px-4 shadow-sm fw-bold me-1">Download CSV</button>
                                 </div>
                                 
                                 <div v-if="currentView === 'quizzes'">
                                    <div class="row">
                                        <div v-for="q in upcomingQuizzes" :key="q.id" class="col-md-6 mb-4">
                                            <div class="card h-100 shadow-sm border-0 rounded-4 transition-hover">
                                                <div class="card-header bg-white border-0 pt-4 pb-2">
                                                    <span class="badge bg-primary text-uppercase mb-2 px-3 py-2 rounded-pill shadow-sm">{{ q.subject_name }}</span>
                                                    <h5 class="card-title fw-bold text-dark mb-1">{{ q.remarks }}</h5>
                                                    <small class="text-muted fw-bold">{{ q.chapter_name }}</small>
                                                </div>
                                                <div class="card-body py-3 bg-light m-3 rounded-3">
                                                    <div class="d-flex justify-content-between small text-dark fw-bold">
                                                        <span>Date: {{ q.date_of_quiz }}</span>
                                                        <span>Time: {{ q.time_duration }} mins</span>
                                                    </div>
                                                </div>
                                                <div class="card-footer bg-white border-0 pb-4 pt-0">
                                                    <button @click="startQuiz(q.id)" class="btn btn-dark w-100 rounded-pill fw-bold shadow-sm py-2">Start Challenge</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div v-if="missedQuizzes.length > 0" class="mt-4 pt-3 border-top">
                                        <h6 class="text-danger fw-bold text-uppercase mb-3">Missed Opportunities</h6>
                                        <div class="row">
                                            <div v-for="q in missedQuizzes" :key="q.id" class="col-md-6 mb-4">
                                                <div class="card h-100 shadow-sm border-0 opacity-75 bg-light rounded-4">
                                                    <div class="card-body p-4">
                                                        <span class="badge bg-secondary mb-2 rounded-pill px-3">Expired</span>
                                                        <h5 class="card-title text-muted fw-bold mb-1">{{ q.remarks }}</h5>
                                                        <small class="text-danger fw-bold">Deadline was: {{ q.date_of_quiz }}</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div v-if="completedQuizzes.length > 0" class="mt-4 pt-3 border-top">
                                        <h6 class="text-success fw-bold text-uppercase mb-3">Completed Challenges</h6>
                                        <div class="row">
                                            <div v-for="q in completedQuizzes" :key="q.id" class="col-md-6 mb-4">
                                                <div class="card h-100 shadow-sm border-0 bg-white rounded-4 border-start border-success border-4">
                                                    <div class="card-body p-4">
                                                        <span class="badge bg-success mb-2 rounded-pill px-3">Done</span>
                                                        <h5 class="card-title text-dark fw-bold mb-1">{{ q.remarks }}</h5>
                                                        <small class="text-muted d-block mb-3">Check Performance Lab for score</small>
                                                        <button @click="switchView('scores')" class="btn btn-outline-success btn-sm rounded-pill px-4 fw-bold">View Result</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div v-if="upcomingQuizzes.length === 0 && missedQuizzes.length === 0 && completedQuizzes.length === 0" class="col-12">
                                        <div class="alert alert-light border border-2 text-center p-5 shadow-sm rounded-4">
                                            <h4 class="fw-bold text-muted mb-2">Welcome aboard!</h4>
                                            <p class="text-muted mb-0">No quizzes have been assigned to you yet.</p>
                                        </div>
                                    </div>
                                 </div>

                                 <div v-if="currentView === 'scores'" class="row">
                                    <div class="col-12 mb-4">
                                        <div class="card shadow-sm border-0 rounded-4 p-2">
                                            <div class="card-header bg-white py-3 border-0"><h6 class="mb-0 fw-bold">Recent Score Trend (0-100%)</h6></div>
                                            <div class="card-body"><div style="height: 200px; position: relative;"><canvas id="trendChart"></canvas></div></div>
                                        </div>
                                    </div>
                                    <div class="col-12">
                                        <div class="card shadow-sm border-0 rounded-4 overflow-hidden">
                                            <div class="card-header bg-white py-3 border-0"><h6 class="mb-0 fw-bold">Detailed Logs</h6></div>
                                            <table class="table table-hover mb-0">
                                                <thead><tr class="bg-light text-muted small text-uppercase"><th>Test Name</th><th>Score</th><th>Date Attempted</th></tr></thead>
                                                <tbody>
                                                    <tr v-for="s in userScores" :key="s.id">
                                                        <td class="fw-bold text-dark">{{ s.quiz_remarks }}</td>
                                                        <td><span class="badge rounded-pill px-3 py-2" :class="s.score/s.total_questions >= 0.8 ? 'bg-success' : 'bg-warning text-dark'">{{ s.score }} / {{ s.total_questions }}</span></td>
                                                        <td class="text-muted">{{ s.timestamp }}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                 </div>

                                 <div v-if="currentView === 'profile'" class="row">
                                     <div class="col-12">
                                         <div class="card shadow-sm border-0 rounded-4">
                                             <div class="card-header bg-white py-4 border-0"><h5 class="mb-0 fw-bold">Update My Information</h5></div>
                                             <div class="card-body p-4 p-md-5 pt-0">
                                                 <form @submit.prevent="saveUserProfile">
                                                     <div class="row mb-3">
                                                         <div class="col-md-6">
                                                            <label class="small fw-bold text-muted mb-2">Full Name</label>
                                                            <input v-model="profileData.full_name" class="form-control form-control-lg bg-light border-0 shadow-none" required>
                                                         </div>
                                                         <div class="col-md-6">
                                                            <label class="small fw-bold text-muted mb-2">Email (Read Only)</label>
                                                            <input v-model="profileData.email" class="form-control form-control-lg bg-light border-0 shadow-none text-muted" disabled>
                                                         </div>
                                                     </div>
                                                     <div class="row mb-5">
                                                         <div class="col-md-6">
                                                            <label class="small fw-bold text-muted mb-2">Qualification</label>
                                                            <input v-model="profileData.qualification" class="form-control form-control-lg bg-light border-0 shadow-none">
                                                         </div>
                                                         <div class="col-md-6">
                                                            <label class="small fw-bold text-muted mb-2">Date of Birth</label>
                                                            <input v-model="profileData.dob" type="date" class="form-control form-control-lg bg-light border-0 shadow-none">
                                                         </div>
                                                     </div>
                                                     <h5 class="fw-bold border-bottom pb-3 mb-4">Security Settings</h5>
                                                     <div class="mb-4">
                                                        <label class="small fw-bold text-muted mb-2">New Password</label>
                                                        <input v-model="profileData.new_password" type="password" class="form-control form-control-lg bg-light border-0 shadow-none" placeholder="Leave blank to keep current password">
                                                     </div>
                                                     <button class="btn btn-primary btn-lg px-5 rounded-pill shadow-sm fw-bold">Save All Changes</button>
                                                 </form>
                                             </div>
                                         </div>
                                     </div>
                                 </div>

                                 <div v-if="currentView === 'playing'" class="row justify-content-center">
                                    <div class="col-12">
                                        <div class="d-flex justify-content-between align-items-center mb-4 bg-white p-4 rounded-4 shadow-sm border">
                                            <div>
                                                <h3 class="fw-bold mb-1 text-dark">{{ activeQuiz.remarks }}</h3>
                                                <span class="badge bg-primary rounded-pill px-3">{{ activeQuiz.subject_name }}</span>
                                            </div>
                                            <div class="d-flex align-items-center">
                                                <div class="badge fs-4 me-4 px-4 py-2 shadow-sm rounded-pill" :class="timeRemaining <= 60 ? 'border border-2 border-danger text-danger bg-white' : 'bg-light text-dark border border-2 border-light'">
                                                    Time: {{ formattedTime }}
                                                </div>
                                                <button @click="cancelQuiz" class="btn btn-outline-danger px-4 rounded-pill shadow-sm fw-bold border-2">Quit Test</button>
                                            </div>
                                        </div>

                                        <div v-for="(q, index) in activeQuestions" :key="q.id" class="card mb-4 shadow-sm border-0 rounded-4 overflow-hidden">
                                            <div class="card-header bg-dark text-white py-3 border-0">
                                                <h5 class="fw-bold mb-0">Question {{ index + 1 }}</h5>
                                            </div>
                                            <div class="card-body p-4 p-md-5">
                                                <h4 class="fw-bold mb-4 text-dark">{{ q.question_statement }}</h4>
                                                <div class="row g-4">
                                                    <div v-for="(opt, i) in q.options" :key="i" class="col-md-6">
                                                        <label class="list-group-item list-group-item-action rounded-4 border-2 p-4 cursor-pointer" :class="userAnswers[q.id] === i+1 ? 'border-primary bg-primary bg-opacity-10 shadow-sm' : 'bg-light border-light'">
                                                            <div class="d-flex align-items-center">
                                                                <input class="form-check-input me-3 shadow-none border-secondary" style="transform: scale(1.5);" type="radio" :name="'q'+q.id" :value="i+1" v-model="userAnswers[q.id]"> 
                                                                <span class="fs-5 text-dark fw-medium">{{ opt }}</span>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="card shadow-sm border-0 rounded-4 p-4 mt-5 text-center bg-white">
                                            <h5 class="fw-bold mb-3 text-dark">Ready to finish?</h5>
                                            <button @click="submitQuiz(false)" class="btn btn-success btn-lg px-5 shadow fw-bold rounded-pill mx-auto">Submit Final Answers</button>
                                        </div>
                                    </div>
                                 </div>
                            </div>

                            <div class="col-md-3">
                                <div v-if="currentView !== 'playing'">
                                    <div class="card shadow-sm border-0 bg-white mb-4 rounded-4 overflow-hidden">
                                        <div class="card-header border-0 bg-dark py-3 text-center">
                                            <span class="fw-bold text-white letter-spacing-1">DAILY PLANNER</span>
                                        </div>
                                        <div class="card-body p-3">
                                            <div v-if="upcomingQuizzes.length > 0">
                                                <div v-for="q in upcomingQuizzes.slice(0, 3)" :key="q.id" class="p-3 mb-3 border rounded-4 bg-light text-center">
                                                    <h6 class="mb-1 fw-bold text-dark">{{ q.remarks }}</h6>
                                                    <small class="text-primary fw-bold d-block mb-3">{{ q.chapter_name }}</small>
                                                    <button @click="startQuiz(q.id)" class="btn btn-dark btn-sm w-100 py-2 rounded-pill fw-bold shadow-sm">Begin Now</button>
                                                </div>
                                            </div>
                                            <div v-else class="text-center py-5 text-muted">
                                                <p class="fw-bold small text-uppercase">No pending tests</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer class="bg-white border-top py-4 mt-auto shadow-sm">
                <div class="container text-center">
                    <h6 class="fw-bold text-dark mb-1">Quizzo Assessment Platform <span class="badge bg-primary ms-1 text-uppercase" style="font-size: 0.6rem;">PRO</span></h6>
                    <small class="text-muted">&copy; 2026 Quizzo Inc. All rights reserved.</small>
                </div>
            </footer>

            <div v-if="modal.isVisible" class="modal fade show" style="display: block; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                        <div class="modal-header text-white border-0 px-4 py-3" :class="'bg-'+modal.type">
                            <h5 class="modal-title fw-bold">{{modal.title}}</h5>
                            <button class="btn-close btn-close-white shadow-none" @click="closeModal"></button>
                        </div>
                        <div class="modal-body p-4 text-center">
                            <p class="mb-0 fs-5 text-dark">{{modal.message}}</p>
                        </div>
                        <div class="modal-footer border-0 bg-light p-3 d-flex justify-content-center">
                            <button v-if="modal.onConfirm" class="btn btn-light border-secondary text-muted px-4 rounded-pill fw-bold me-2" @click="closeModal">Cancel</button>
                            <button class="btn px-5 rounded-pill shadow-sm fw-bold" :class="'btn-'+modal.type" @click="confirmAction">Confirm</button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="editContext.isVisible" class="modal fade show" style="display: block; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                        <div class="modal-header bg-dark text-white border-0 px-4 py-3">
                            <h5 class="modal-title fw-bold text-capitalize">Edit {{ editContext.type }}</h5>
                            <button class="btn-close btn-close-white shadow-none" @click="closeEditModal"></button>
                        </div>
                        <div class="modal-body p-4">
                            
                            <div v-if="editContext.type === 'student'">
                                <label class="small fw-bold text-muted mb-1">Full Name</label>
                                <input v-model="editContext.payload.full_name" class="form-control bg-light border-0 mb-3" placeholder="Full Name">
                                <label class="small fw-bold text-muted mb-1">Email</label>
                                <input v-model="editContext.payload.email" type="email" class="form-control bg-light border-0 mb-3" placeholder="Email Address">
                                <label class="small fw-bold text-muted mb-1">Qualification</label>
                                <input v-model="editContext.payload.qualification" class="form-control bg-light border-0 mb-3" placeholder="Qualification">
                                <label class="small fw-bold text-muted mb-1">Date of Birth</label>
                                <input v-model="editContext.payload.dob" type="date" class="form-control bg-light border-0 mb-2">
                            </div>

                            <div v-if="editContext.type === 'subject' || editContext.type === 'chapter'">
                                <label class="small fw-bold text-muted mb-1">Name</label>
                                <input v-model="editContext.payload.name" class="form-control bg-light border-0 mb-3" placeholder="Name">
                                <label class="small fw-bold text-muted mb-1">Description</label>
                                <input v-model="editContext.payload.description" class="form-control bg-light border-0 mb-2" placeholder="Description">
                            </div>
                            
                            <div v-if="editContext.type === 'quiz'">
                                <label class="small fw-bold text-muted mb-1">Quiz Title</label>
                                <input v-model="editContext.payload.remarks" class="form-control bg-light border-0 mb-3" placeholder="Title">
                                <label class="small fw-bold text-muted mb-1">Date of Quiz</label>
                                <input v-model="editContext.payload.date_of_quiz" type="date" class="form-control bg-light border-0 mb-3">
                                <label class="small fw-bold text-muted mb-1">Duration (Minutes)</label>
                                <input v-model="editContext.payload.time_duration" type="number" min="3" max="30" class="form-control bg-light border-0 mb-2" placeholder="Duration">
                            </div>
                            
                            <div v-if="editContext.type === 'question'">
                                <label class="small fw-bold text-muted mb-1">Question Statement</label>
                                <textarea v-model="editContext.payload.question_statement" class="form-control bg-light border-0 mb-3"></textarea>
                                
                                <div class="row g-2 mb-3">
                                    <div class="col-6"><input v-model="editContext.payload.option1" class="form-control form-control-sm bg-light border-0 py-2" placeholder="Option 1"></div>
                                    <div class="col-6"><input v-model="editContext.payload.option2" class="form-control form-control-sm bg-light border-0 py-2" placeholder="Option 2"></div>
                                    <div class="col-6"><input v-model="editContext.payload.option3" class="form-control form-control-sm bg-light border-0 py-2" placeholder="Option 3"></div>
                                    <div class="col-6"><input v-model="editContext.payload.option4" class="form-control form-control-sm bg-light border-0 py-2" placeholder="Option 4"></div>
                                </div>

                                <label class="small fw-bold text-muted mb-1">Correct Option (1-4)</label>
                                <input v-model="editContext.payload.correct_option" type="number" min="1" max="4" class="form-control bg-light border-0 mb-2">
                            </div>
                        </div>
                        <div class="modal-footer border-0 bg-light p-3">
                            <button class="btn btn-light border-secondary text-muted px-4 rounded-pill fw-bold" @click="closeEditModal">Cancel</button>
                            <button class="btn btn-primary px-5 rounded-pill shadow-sm fw-bold" @click="saveEdit">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="showNotifModal" class="modal fade show" style="display: block; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);">
                <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                        <div class="modal-header bg-primary text-white border-0 px-4 py-3">
                            <h5 class="modal-title fw-bold">Live Alerts</h5>
                            <button class="btn-close btn-close-white shadow-none" @click="closeNotifModal"></button>
                        </div>
                        <div class="modal-body p-0 bg-light">
                            <div v-if="notifications.length === 0" class="text-center text-muted py-5">
                                <p class="mb-0 fw-bold">No new alerts right now.</p>
                            </div>
                            <div class="list-group list-group-flush">
                                <div v-for="n in notifications" :key="n.id" class="list-group-item bg-white px-4 py-3 border-bottom">
                                    <div class="d-flex justify-content-between mb-2">
                                        <small class="text-primary fw-bold">{{ n.timestamp }}</small>
                                    </div>
                                    <p class="mb-2 text-dark fw-medium">{{ n.message }}</p>
                                    <a v-if="n.action_link" :href="n.action_link" target="_blank" class="btn btn-sm btn-outline-primary rounded-pill px-4 fw-bold mt-1">Open Report</a>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer border-0 bg-white p-3 text-center d-block">
                            <button class="btn btn-secondary rounded-pill px-5 fw-bold shadow-sm" @click="closeNotifModal">Close Window</button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    `
};

const app = createApp(App);
app.mount('#app');