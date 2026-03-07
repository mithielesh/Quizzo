const { createApp, ref, reactive, onMounted, computed, nextTick, watch } = Vue;

const App = {
    setup() {
        // --- GLOBAL STATE ---
        const user = reactive({
            isAuthenticated: !!localStorage.getItem('auth_token'),
            token: localStorage.getItem('auth_token') || null,
            role: localStorage.getItem('user_role') || null,
            email: localStorage.getItem('user_email') || null,
            full_name: localStorage.getItem('user_name') || 'User',
            qualification: localStorage.getItem('user_qual') || ''
        });

        const modal = reactive({ isVisible: false, title: '', message: '', type: 'primary', onConfirm: null });
        const showModal = (t, m, type='primary', cb=null) => { modal.title=t; modal.message=m; modal.type=type; modal.onConfirm=cb; modal.isVisible=true; };
        const closeModal = () => { modal.isVisible = false; };
        const confirmAction = () => { if (modal.onConfirm) modal.onConfirm(); closeModal(); };

        // --- AUTH ---
        const isRegistering = ref(false); 
        const credentials = reactive({ email: '', password: '', full_name: '', qualification: '', dob: '' });
        const toggleAuthMode = () => { isRegistering.value = !isRegistering.value; Object.keys(credentials).forEach(k => credentials[k] = ''); };

        const authAction = async () => {
            const endpoint = isRegistering.value ? '/api/auth/register' : '/api/auth/login';
            try {
                const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
                const data = await res.json();
                if (res.ok) {
                    if (isRegistering.value) { showModal('Success', 'Registered! Please Login.', 'success'); toggleAuthMode(); }
                    else {
                        user.isAuthenticated = true; user.token = data.user.token; user.role = data.user.role; user.email = data.user.email;
                        user.full_name = data.user.full_name || 'User'; user.qualification = data.user.qualification || '';
                        localStorage.setItem('auth_token', 'true'); localStorage.setItem('user_role', data.user.role); 
                        localStorage.setItem('user_email', data.user.email); localStorage.setItem('user_name', user.full_name); 
                        localStorage.setItem('user_qual', user.qualification); loadDashboard();
                    }
                } else { showModal('Error', data.message, 'danger'); }
            } catch (e) { showModal('System Error', 'Connection failed.', 'danger'); }
        };

        const logout = async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {} user.isAuthenticated = false; localStorage.clear(); };

        // --- ADMIN: MANAGE CONTENT ---
        const adminView = ref('manage'); 
        const subjects = ref([]); const newSubject = reactive({ name: '', description: '' });
        const searchQuery = ref("");
        const selectedSubject = ref(null); const chapters = ref([]); const newChapter = reactive({ name: '', description: '' });
        const selectedChapter = ref(null); const quizzes = ref([]); const newQuiz = reactive({ date_of_quiz: '', time_duration: 30, remarks: '' });
        const selectedQuiz = ref(null); const questions = ref([]); const newQuestion = reactive({ question_statement: '', option1: '', option2: '', option3: '', option4: '', correct_option: 1 });

        const filteredSubjects = computed(() => {
            if (!searchQuery.value) return subjects.value;
            return subjects.value.filter(s => s.name.toLowerCase().includes(searchQuery.value.toLowerCase()));
        });

        const fetchSubjects = async () => { try{ const res = await fetch('/api/admin/subjects'); if(res.ok) subjects.value = await res.json(); }catch(e){} };
        const createSubject = async () => { const res = await fetch('/api/admin/subjects', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newSubject)}); if(res.ok){ showModal('Success', 'Subject Created!', 'success'); subjects.value.push((await res.json()).subject); newSubject.name=''; newSubject.description=''; } };
        
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
        
        const viewChapters = async (s) => { selectedSubject.value=s; const res = await fetch(`/api/admin/subjects/${s.id}/chapters`); if(res.ok) chapters.value=await res.json(); };
        const createChapter = async () => { const res = await fetch(`/api/admin/subjects/${selectedSubject.value.id}/chapters`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newChapter)}); if(res.ok){ showModal('Success', 'Chapter Added!', 'success'); chapters.value.push((await res.json()).chapter); newChapter.name=''; newChapter.description=''; } };
        const viewQuizzes = async (c) => { selectedChapter.value=c; const res = await fetch(`/api/admin/chapters/${c.id}/quizzes`); if(res.ok) quizzes.value=await res.json(); };
        const createQuiz = async () => { const res = await fetch(`/api/admin/chapters/${selectedChapter.value.id}/quizzes`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newQuiz)}); if(res.ok){ showModal('Success', 'Quiz Added!', 'success'); quizzes.value.push((await res.json()).quiz); newQuiz.remarks=''; newQuiz.date_of_quiz=''; } };
        const viewQuestions = async (q) => { selectedQuiz.value=q; const res = await fetch(`/api/admin/quizzes/${q.id}/questions`); if(res.ok) questions.value=await res.json(); };
        const createQuestion = async () => { const res = await fetch(`/api/admin/quizzes/${selectedQuiz.value.id}/questions`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newQuestion)}); if(res.ok){ showModal('Success', 'Question Added!', 'success'); questions.value.push((await res.json()).question); newQuestion.question_statement=''; newQuestion.option1=''; newQuestion.option2=''; newQuestion.option3=''; newQuestion.option4=''; } };

        const goBackToSubjects = () => { selectedSubject.value = null; };
        const goBackToChapters = () => { selectedChapter.value = null; };
        const goBackToQuizzes = () => { selectedQuiz.value = null; };

        // --- NEW: EDIT CONTENT LOGIC (Includes Student) ---
        const editContext = reactive({ isVisible: false, type: '', id: null, payload: {} });
        
        const openEditModal = (type, item) => {
            editContext.type = type;
            editContext.id = item.id;
            editContext.payload = JSON.parse(JSON.stringify(item)); // Deep copy to avoid auto-updating UI before save
            editContext.isVisible = true;
        };

        const closeEditModal = () => { editContext.isVisible = false; };

        const saveEdit = async () => { 
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

        // --- ADMIN ANALYTICS ---
        const analyticsTab = ref('quiz');
        const allQuizzes = ref([]);
        const selectedAnalyticsQuiz = ref(null);
        const studentSearchQuery = ref("");
        const studentSearchResults = ref([]);
        const selectedStudentStats = ref(null);

        watch(analyticsTab, (newTab) => {
            if (newTab === 'quiz' && selectedAnalyticsQuiz.value) {
                nextTick(() => renderAdminQuizCharts());
            } else if (newTab === 'student' && selectedStudentStats.value) {
                nextTick(() => renderAdminStudentCharts());
            }
        });

        const fetchAnalyticsQuizzes = async () => { try { const res = await fetch('/api/admin/analytics/quizzes'); if(res.ok) allQuizzes.value = await res.json(); } catch(e){} };
        
        const viewQuizAnalytics = async (quizId) => {
            try {
                const res = await fetch(`/api/admin/analytics/quiz/${quizId}`);
                if (res.ok) { selectedAnalyticsQuiz.value = await res.json(); nextTick(() => renderAdminQuizCharts()); }
            } catch(e){}
        };

        const searchStudents = async () => {
            if (!studentSearchQuery.value) return;
            try { const res = await fetch(`/api/admin/analytics/students/search?q=${studentSearchQuery.value}`); if (res.ok) studentSearchResults.value = await res.json(); } catch(e){}
        };

        const viewStudentAnalytics = async (studentId) => {
            try {
                const res = await fetch(`/api/admin/analytics/student/${studentId}`);
                if (res.ok) { selectedStudentStats.value = await res.json(); nextTick(() => renderAdminStudentCharts()); }
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
                data: { labels: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'], datasets: [{ label: 'Students', data: selectedAnalyticsQuiz.value.score_distribution, backgroundColor: '#0d6efd' }] },
                options: { responsive: true, maintainAspectRatio: false }
            });

            adminChartInstances.att = new Chart(ctxAtt, {
                type: 'doughnut',
                data: { labels: ['Attended', 'Missed', 'Pending'], datasets: [{ data: [selectedAnalyticsQuiz.value.stats.attended, selectedAnalyticsQuiz.value.stats.missed, selectedAnalyticsQuiz.value.stats.pending], backgroundColor: ['#198754', '#dc3545', '#ffc107'] }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        };

        const renderAdminStudentCharts = () => {
            const ctxPerf = document.getElementById('studentPerfChart');
            if (!ctxPerf || !selectedStudentStats.value) return;
            if (adminChartInstances.perf) adminChartInstances.perf.destroy();

            adminChartInstances.perf = new Chart(ctxPerf, {
                type: 'line',
                data: { labels: selectedStudentStats.value.history.map(h => h.quiz_name), datasets: [{ label: 'Score (%)', data: selectedStudentStats.value.history.map(h => h.percentage), borderColor: '#6610f2', fill: true, backgroundColor: 'rgba(102, 16, 242, 0.1)', tension: 0.3 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
            });
        };

        // --- STUDENT DASHBOARD & TIMER LOGIC ---
        const studentQuizzes = ref([]); const userScores = ref([]); const currentView = ref('quizzes'); 
        const activeQuiz = ref(null); const activeQuestions = ref([]); const userAnswers = reactive({});

        // Timer Variables
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

        const fetchStudentQuizzes = async () => { try { const res = await fetch('/api/user/quizzes'); if(res.ok) studentQuizzes.value = await res.json(); } catch(e){} };
        const fetchUserScores = async () => { try { const res = await fetch('/api/user/scores'); if(res.ok) userScores.value = await res.json(); } catch(e){} };

        const todayStr = new Date().toISOString().split('T')[0];
        const upcomingQuizzes = computed(() => { const attemptedIds = userScores.value.map(s => s.quiz_id); return studentQuizzes.value.filter(q => !attemptedIds.includes(q.id) && q.date_of_quiz >= todayStr); });
        const missedQuizzes = computed(() => { const attemptedIds = userScores.value.map(s => s.quiz_id); return studentQuizzes.value.filter(q => !attemptedIds.includes(q.id) && q.date_of_quiz < todayStr); });
        const completedQuizzes = computed(() => { const attemptedIds = userScores.value.map(s => s.quiz_id); return studentQuizzes.value.filter(q => attemptedIds.includes(q.id)); });

        const switchView = (view) => { currentView.value = view; if (view === 'quizzes') fetchStudentQuizzes(); if (view === 'scores') fetchUserScores().then(() => nextTick(() => renderUserCharts())); };
        const userStats = computed(() => { const scores = userScores.value; if (scores.length === 0) return { total: 0, avg: 0 }; const sum = scores.reduce((acc, s) => acc + (s.score / s.total_questions * 100), 0); return { total: scores.length, avg: Math.round(sum / scores.length) }; });

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

        const cancelQuiz = () => { showModal('Quit?', 'Progress lost.', 'danger', () => { stopTimer(); currentView.value = 'quizzes'; activeQuiz.value = null; }); };

        const submitQuiz = (autoSubmit = false) => { 
            const performSubmission = async () => {
                stopTimer();
                try { 
                    const res = await fetch(`/api/user/quiz/${activeQuiz.value.id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: userAnswers }) }); 
                    const data = await res.json(); 
                    if (res.ok) { 
                        showModal('Result', `Score: ${data.score}`, 'success', () => { fetchUserScores().then(() => switchView('scores')); }); 
                    } 
                } catch (e) {} 
            };

            if (autoSubmit === true) { showModal('Time is Up!', 'Your quiz has been automatically submitted.', 'warning', performSubmission); } 
            else { showModal('Submit?', 'Sure?', 'primary', performSubmission); }
        };

        const triggerExport = async () => { showModal('Processing', 'Generating CSV...', 'info'); try { const res = await fetch('/api/user/export', { method: 'POST' }); const data = await res.json(); if (res.ok) { showModal('Success', 'Report ready!', 'success', () => { window.location.href = `/api/user/download-csv/${data.job_id}`; }); } } catch (e) {} };

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

        const loadDashboard = () => { 
            if (user.role === 'admin') { fetchSubjects(); fetchAnalyticsQuizzes(); } 
            if (user.role === 'user') { fetchStudentQuizzes(); fetchUserScores(); } 
        };
        onMounted(() => { if (user.isAuthenticated) loadDashboard(); });

        return { 
            user, credentials, isRegistering, toggleAuthMode, authAction, logout,
            subjects, newSubject, createSubject, deleteItem,
            selectedSubject, chapters, newChapter, viewChapters, createChapter, goBackToSubjects,
            selectedChapter, quizzes, newQuiz, viewQuizzes, createQuiz, goBackToChapters,
            selectedQuiz, questions, newQuestion, viewQuestions, createQuestion, goBackToQuizzes,
            adminView, analyticsTab, allQuizzes, selectedAnalyticsQuiz, viewQuizAnalytics, 
            studentSearchQuery, studentSearchResults, searchStudents, selectedStudentStats, viewStudentAnalytics,
            studentQuizzes, userScores, currentView, switchView, startQuiz, activeQuiz, activeQuestions, userAnswers, submitQuiz, cancelQuiz, triggerExport,
            modal, closeModal, confirmAction, searchQuery, filteredSubjects, userStats, upcomingQuizzes, missedQuizzes, completedQuizzes,
            timeRemaining, formattedTime, 
            editContext, openEditModal, closeEditModal, saveEdit 
        };
    },
    template: `
        <div class="container mt-5">
            <div v-if="!user.isAuthenticated" class="row justify-content-center">
                <div class="col-md-6"><div class="card shadow border-0"><div class="card-header bg-primary text-white text-center py-3"><h4 class="mb-0 fw-bold">{{ isRegistering ? 'Create Account' : 'Welcome Back' }}</h4></div><div class="card-body p-4"><form @submit.prevent="authAction"><div class="mb-3"><label class="small fw-bold">Email Address</label><input v-model="credentials.email" type="email" class="form-control shadow-none" required></div><div class="mb-3"><label class="small fw-bold">Password</label><input v-model="credentials.password" type="password" class="form-control shadow-none" required></div><div v-if="isRegistering"><div class="mb-3"><label class="small fw-bold">Name</label><input v-model="credentials.full_name" class="form-control" required></div><div class="mb-3"><label class="small fw-bold">Qualification</label><input v-model="credentials.qualification" class="form-control"></div><div class="mb-3"><label class="small fw-bold">DOB</label><input v-model="credentials.dob" type="date" class="form-control"></div></div><button class="btn btn-primary w-100 mb-3">{{ isRegistering ? 'Register' : 'Login' }}</button><div class="text-center small"><a href="#" @click.prevent="toggleAuthMode">{{ isRegistering ? 'Login instead' : 'Create Account' }}</a></div></form></div></div></div>
            </div>

            <div v-else>
                <nav class="navbar navbar-expand navbar-dark bg-dark mb-4 px-4 rounded shadow-sm d-flex justify-content-between"><span class="navbar-brand fw-bold">QuizMaster <span class="text-primary">PRO</span></span><div class="d-flex align-items-center"><span class="text-white me-3 small d-none d-md-block">{{ user.email }} ({{ user.role }})</span><button @click="logout" class="btn btn-outline-danger btn-sm rounded-pill px-3">Logout</button></div></nav>

                <div v-if="user.role === 'admin'">
                    <div class="d-flex mb-4">
                        <button class="btn me-2 px-4 shadow-sm" :class="adminView === 'manage' ? 'btn-dark' : 'btn-outline-dark'" @click="adminView = 'manage'">Manage Content</button>
                        <button class="btn px-4 shadow-sm" :class="adminView === 'analytics' ? 'btn-dark' : 'btn-outline-dark'" @click="adminView = 'analytics'; fetchAnalyticsQuizzes();">Analytics & Reports</button>
                    </div>

                    <div v-if="adminView === 'manage'">
                        <div v-if="!selectedSubject" class="row"><div class="col-md-4"><div class="card p-3 shadow-sm mb-3 border-0 bg-light"><h5>Add Subject</h5><form @submit.prevent="createSubject"><input v-model="newSubject.name" class="form-control mb-2" placeholder="Name"><button class="btn btn-success w-100">Create</button></form></div></div><div class="col-md-8"><div class="card shadow-sm border-0"><div class="card-header bg-white"><h5 class="mb-0">Subjects</h5></div><ul class="list-group list-group-flush"><li v-for="sub in filteredSubjects" :key="sub.id" class="list-group-item d-flex justify-content-between align-items-center"><span>{{ sub.name }}</span><div><button @click="viewChapters(sub)" class="btn btn-sm btn-primary me-2">Manage</button><button @click="openEditModal('subject', sub)" class="btn btn-sm btn-outline-secondary me-2">Edit</button><button @click="deleteItem('subject', sub.id)" class="btn btn-sm btn-outline-danger">Delete</button></div></li></ul></div></div></div>
                        <div v-else-if="!selectedChapter" class="row"><div class="col-12 mb-3"><button @click="goBackToSubjects" class="btn btn-secondary btn-sm me-2">Back</button> <h3 class="d-inline">{{ selectedSubject.name }}</h3></div><div class="col-md-4"><div class="card p-3 border-0 bg-light shadow-sm"><h5>Add Chapter</h5><form @submit.prevent="createChapter"><input v-model="newChapter.name" class="form-control mb-2" placeholder="Name"><button class="btn btn-success w-100">Add</button></form></div></div><div class="col-md-8"><div class="list-group shadow-sm"><div v-for="c in chapters" :key="c.id" class="list-group-item d-flex justify-content-between align-items-center"><span class="fw-bold">{{ c.name }}</span><div><button @click="viewQuizzes(c)" class="btn btn-sm btn-info text-white me-2">Quizzes</button><button @click="openEditModal('chapter', c)" class="btn btn-sm btn-outline-secondary me-2">Edit</button><button @click="deleteItem('chapter', c.id)" class="btn btn-sm btn-outline-danger">Delete</button></div></div></div></div></div>
                        <div v-else-if="!selectedQuiz" class="row"><div class="col-12 mb-3"><button @click="goBackToChapters" class="btn btn-secondary btn-sm me-2">Back</button> <h3 class="d-inline">{{ selectedChapter.name }}</h3></div><div class="col-md-4"><div class="card p-3 border-0 bg-light shadow-sm"><h5>Add Quiz</h5><form @submit.prevent="createQuiz"><input v-model="newQuiz.remarks" class="form-control mb-2" placeholder="Title"><input v-model="newQuiz.date_of_quiz" type="date" class="form-control mb-2"><input v-model="newQuiz.time_duration" type="number" class="form-control mb-2" placeholder="Mins"><button class="btn btn-success w-100">Add</button></form></div></div><div class="col-md-8"><div class="list-group shadow-sm"><div v-for="q in quizzes" :key="q.id" class="list-group-item d-flex justify-content-between align-items-center"><span>{{ q.remarks }}</span><div><button @click="viewQuestions(q)" class="btn btn-sm btn-warning me-2">Questions</button><button @click="openEditModal('quiz', q)" class="btn btn-sm btn-outline-secondary me-2">Edit</button><button @click="deleteItem('quiz', q.id)" class="btn btn-sm btn-outline-danger">Delete</button></div></div></div></div></div>
                        <div v-else class="row"><div class="col-12 mb-3"><button @click="goBackToQuizzes" class="btn btn-secondary btn-sm me-2">Back</button> <h3 class="d-inline">Questions</h3></div><div class="col-md-5"><div class="card p-3 border-0 bg-light shadow-sm"><h5>Add Question</h5><form @submit.prevent="createQuestion"><textarea v-model="newQuestion.question_statement" class="form-control mb-2" placeholder="Statement"></textarea><div class="row g-1"><div class="col-6"><input v-model="newQuestion.option1" class="form-control form-control-sm mb-1" placeholder="Op 1"></div><div class="col-6"><input v-model="newQuestion.option2" class="form-control form-control-sm mb-1" placeholder="Op 2"></div><div class="col-6"><input v-model="newQuestion.option3" class="form-control form-control-sm mb-1" placeholder="Op 3"></div><div class="col-6"><input v-model="newQuestion.option4" class="form-control form-control-sm mb-1" placeholder="Op 4"></div></div><input v-model="newQuestion.correct_option" type="number" class="form-control mb-2 mt-2" placeholder="Correct (1-4)"><button class="btn btn-success w-100">Add</button></form></div></div><div class="col-md-7"><div class="list-group shadow-sm"><div v-for="q in questions" class="list-group-item small d-flex justify-content-between"><span>{{ q.question_statement }} (Ans: {{ q.correct_option }})</span><div><button @click="openEditModal('question', q)" class="btn btn-sm btn-outline-secondary me-2">Edit</button><button @click="deleteItem('question', q.id)" class="btn btn-sm btn-outline-danger">Delete</button></div></div></div></div></div>
                    </div>

                    <div v-if="adminView === 'analytics'">
                        <div class="card shadow-sm border-0 mb-3">
                            <div class="card-header bg-white"><ul class="nav nav-tabs card-header-tabs"><li class="nav-item"><a class="nav-link" :class="analyticsTab === 'quiz' ? 'active fw-bold' : 'text-muted'" href="#" @click.prevent="analyticsTab = 'quiz'">Quiz Reports</a></li><li class="nav-item"><a class="nav-link" :class="analyticsTab === 'student' ? 'active fw-bold' : 'text-muted'" href="#" @click.prevent="analyticsTab = 'student'">Student Insights</a></li></ul></div>
                            <div class="card-body">
                                <div v-if="analyticsTab === 'quiz'">
                                    <div v-if="!selectedAnalyticsQuiz">
                                        <h5 class="mb-3">All Quizzes Overview</h5>
                                        <table class="table table-hover"><thead><tr class="bg-light"><th>Quiz Title</th><th>Subject</th><th>Chapter</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody><tr v-for="q in allQuizzes" :key="q.id"><td>{{ q.remarks }}</td><td>{{ q.subject_name }}</td><td class="text-muted small">{{ q.chapter_name }}</td><td>{{ q.date_of_quiz }}</td><td><span class="badge rounded-pill" :class="q.status === 'Completed' ? 'bg-success' : (q.status === 'Active' ? 'bg-primary' : 'bg-warning')">{{ q.status }}</span></td><td><button class="btn btn-sm btn-outline-primary" @click="viewQuizAnalytics(q.id)">View Report</button></td></tr></tbody></table>
                                    </div>
                                    <div v-else>
                                        <button class="btn btn-sm btn-secondary mb-3" @click="selectedAnalyticsQuiz = null">Back</button>
                                        <h4 class="mb-3">{{ selectedAnalyticsQuiz.quiz_title }}</h4>
                                        <div class="row mb-4"><div class="col-md-6"><div class="card shadow-sm h-100"><div class="card-header bg-white fw-bold">Attendance</div><div class="card-body"><div style="height:200px"><canvas id="attendanceChart"></canvas></div></div></div></div><div class="col-md-6"><div class="card shadow-sm h-100"><div class="card-header bg-white fw-bold">Score Distribution</div><div class="card-body"><div style="height:200px"><canvas id="scoreDistChart"></canvas></div></div></div></div></div>
                                        <div class="card shadow-sm"><div class="card-header bg-white fw-bold">Student Register</div><table class="table mb-0"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Score</th></tr></thead><tbody><tr v-for="s in selectedAnalyticsQuiz.students" :key="s.id"><td>{{ s.name }}</td><td>{{ s.email }}</td><td><span class="badge" :class="s.status === 'Attended' ? 'bg-success' : (s.status === 'Missed' ? 'bg-danger' : 'bg-warning text-dark')">{{ s.status }}</span></td><td>{{ s.score }}</td></tr></tbody></table></div>
                                    </div>
                                </div>
                                
                                <div v-if="analyticsTab === 'student'">
                                    <div v-if="!selectedStudentStats">
                                        <div class="card bg-light p-4 mb-3 border-0"><div class="input-group mb-3"><input v-model="studentSearchQuery" type="text" class="form-control" placeholder="Search by name or email..."><button class="btn btn-primary" @click="searchStudents">Search</button></div></div>
                                        <div v-if="studentSearchResults.length > 0" class="card shadow-sm border-0">
                                            <div class="card-header bg-white"><strong>Results</strong></div>
                                            <div class="list-group list-group-flush">
                                                <div v-for="s in studentSearchResults" :key="s.id" class="list-group-item d-flex justify-content-between align-items-center">
                                                    <div><strong>{{ s.full_name }}</strong> <small class="text-muted ms-2">{{ s.email }}</small></div>
                                                    <div>
                                                        <button class="btn btn-sm btn-outline-secondary me-2" @click="openEditModal('student', s)">Edit</button>
                                                        <button class="btn btn-sm btn-outline-danger me-2" @click="deleteItem('student', s.id)">Delete</button>
                                                        <button class="btn btn-sm btn-outline-primary" @click="viewStudentAnalytics(s.id)">View Profile</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-else>
                                        <button class="btn btn-sm btn-secondary mb-3" @click="selectedStudentStats = null">Back to Search</button>
                                        <div class="row mb-4"><div class="col-md-4"><div class="card bg-primary text-white p-3"><h3>{{ selectedStudentStats.total_quizzes }}</h3><small>Quizzes Taken</small></div></div><div class="col-md-4"><div class="card bg-success text-white p-3"><h3>{{ selectedStudentStats.avg_score }}%</h3><small>Avg Score</small></div></div><div class="col-md-4"><div class="card bg-danger text-white p-3"><h3>{{ selectedStudentStats.missed_quizzes }}</h3><small>Missed</small></div></div></div>
                                        <div class="card shadow-sm mb-4"><div class="card-header bg-white fw-bold">Performance</div><div class="card-body"><div style="height:250px"><canvas id="studentPerfChart"></canvas></div></div></div>
                                        <div class="card shadow-sm"><div class="card-header bg-white fw-bold">History</div><table class="table mb-0"><thead><tr><th>Quiz</th><th>Score</th><th>Status</th></tr></thead><tbody><tr v-for="h in selectedStudentStats.history" :key="h.quiz_id"><td>{{ h.quiz_name }}</td><td>{{ h.score }}</td><td><span class="badge" :class="h.status === 'Attended' ? 'bg-success' : 'bg-danger'">{{ h.status }}</span></td></tr></tbody></table></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="user.role === 'user'">
                    <div class="row">
                        <div class="col-md-9">
                             <div v-if="currentView !== 'playing'" class="row mb-4"><div class="col-md-7"><div class="card bg-primary text-white shadow-sm h-100 border-0"><div class="card-body py-4"><h3>Hello, {{ user.full_name }}!</h3><p class="mb-0 opacity-75">{{ user.qualification }}</p></div></div></div><div class="col-md-2 text-center"><div class="card shadow-sm border-0 h-100"><div class="card-body d-flex flex-column justify-content-center"><h3>{{ userStats.total }}</h3><small class="text-muted">Attempts</small></div></div></div><div class="col-md-3 text-center"><div class="card shadow-sm border-0 h-100"><div class="card-body d-flex flex-column justify-content-center"><h3>{{ userStats.avg }}%</h3><small class="text-muted">Overall Average</small></div></div></div></div>
                             <div v-if="currentView !== 'playing'" class="mb-4 d-flex justify-content-between"><div><button class="btn me-2 px-4 shadow-sm" :class="currentView === 'quizzes' ? 'btn-dark' : 'btn-outline-dark'" @click="switchView('quizzes')">Practice Quizzes</button><button class="btn px-4 shadow-sm" :class="currentView === 'scores' ? 'btn-dark' : 'btn-outline-dark'" @click="switchView('scores')">Performance Lab</button></div><button v-if="currentView === 'scores'" @click="triggerExport" class="btn btn-outline-dark btn-sm shadow-sm">Download CSV</button></div>
                             
                             <div v-if="currentView === 'quizzes'">
                                <div class="row"><div v-for="q in upcomingQuizzes" :key="q.id" class="col-md-6 mb-4"><div class="card h-100 shadow-sm border-0 hover-lift"><div class="card-header bg-white border-0 py-3"><span class="badge bg-primary mb-2">{{ q.subject_name }}</span><h5 class="card-title fw-bold mb-0">{{ q.remarks }}</h5><small class="text-muted">{{ q.chapter_name }}</small></div><div class="card-body py-0"><div class="d-flex justify-content-between small text-muted"><span>Date: {{ q.date_of_quiz }}</span><span>Time: {{ q.time_duration }} mins</span></div></div><div class="card-footer bg-white border-0 py-3"><button @click="startQuiz(q.id)" class="btn btn-primary w-100 rounded-pill fw-bold shadow-sm">Start Challenge</button></div></div></div></div>
                                <div v-if="missedQuizzes.length > 0" class="mt-3"><h6 class="text-danger border-bottom pb-2 mb-3">Missed Opportunities</h6><div class="row"><div v-for="q in missedQuizzes" :key="q.id" class="col-md-6 mb-4"><div class="card h-100 shadow-sm border-0 opacity-75 bg-light"><div class="card-header bg-transparent border-0 py-3"><span class="badge bg-secondary mb-2">Expired</span><h5 class="card-title text-muted mb-0">{{ q.remarks }}</h5></div><div class="card-body py-0"><small class="text-danger">Deadline was: {{ q.date_of_quiz }}</small></div><div class="card-footer bg-transparent border-0 py-3"><button disabled class="btn btn-secondary w-100 rounded-pill">No Longer Available</button></div></div></div></div></div>
                                <div v-if="completedQuizzes.length > 0" class="mt-3"><h6 class="text-success border-bottom pb-2 mb-3">Completed Challenges</h6><div class="row"><div v-for="q in completedQuizzes" :key="q.id" class="col-md-6 mb-4"><div class="card h-100 shadow-sm border-0 bg-light"><div class="card-header bg-transparent border-0 py-3"><span class="badge bg-success mb-2">Done</span><h5 class="card-title mb-0">{{ q.remarks }}</h5></div><div class="card-body py-0"><small class="text-muted">Check Performance Lab for score</small></div><div class="card-footer bg-transparent border-0 py-3"><button @click="switchView('scores')" class="btn btn-outline-success w-100 rounded-pill">View Result</button></div></div></div></div></div>
                                <div v-if="upcomingQuizzes.length === 0 && missedQuizzes.length === 0 && completedQuizzes.length === 0" class="col-12"><div class="alert alert-light border text-center p-5 shadow-sm">Welcome! No quizzes have been assigned to you yet.</div></div>
                             </div>

                             <div v-if="currentView === 'scores'" class="row">
                                <div class="col-12 mb-4"><div class="card shadow-sm border-0"><div class="card-header bg-white py-3"><h6 class="mb-0 fw-bold">Recent Score Trend (0-100%)</h6></div><div class="card-body"><div style="height: 180px; position: relative;"><canvas id="trendChart"></canvas></div></div></div></div>
                                <div class="col-12"><div class="card shadow-sm border-0"><div class="card-header bg-white py-3"><h6 class="mb-0 fw-bold">Detailed Logs</h6></div><table class="table table-hover mb-0"><thead><tr class="small text-uppercase text-muted"><th>Test Name</th><th>Score</th><th>Date Attempted</th></tr></thead><tbody><tr v-for="s in userScores" :key="s.id"><td>{{ s.quiz_remarks }}</td><td><span class="badge" :class="s.score/s.total_questions >= 0.8 ? 'bg-success' : 'bg-warning'">{{ s.score }}/{{ s.total_questions }}</span></td><td>{{ s.timestamp }}</td></tr></tbody></table></div></div>
                             </div>

                             <div v-if="currentView === 'playing'" class="row justify-content-center">
                                <div class="col-12">
                                    <div class="d-flex justify-content-between align-items-center mb-4">
                                        <div><h3 class="fw-bold mb-0">{{ activeQuiz.remarks }}</h3><small class="text-muted">Select your answer</small></div>
                                        
                                        <div class="d-flex align-items-center">
                                            <div class="badge bg-light text-dark fs-5 me-3 px-3 py-2 shadow-sm border" :class="{'bg-danger text-white border-danger': timeRemaining <= 60}">
                                                Time: {{ formattedTime }}
                                            </div>
                                            <button @click="cancelQuiz" class="btn btn-outline-danger btn-sm px-4 rounded-pill shadow-sm">Quit</button>
                                        </div>
                                    </div>

                                    <div v-for="(q, index) in activeQuestions" :key="q.id" class="card mb-4 shadow-sm border-0"><div class="card-body p-4"><h5 class="fw-bold mb-4">Q{{ index + 1 }}. {{ q.question_statement }}</h5><div class="row g-3"><div v-for="(opt, i) in q.options" :key="i" class="col-md-6"><label class="list-group-item list-group-item-action rounded-3 border-2 p-3" :class="userAnswers[q.id] === i+1 ? 'border-primary bg-light' : ''"><input class="form-check-input me-3 shadow-none" type="radio" :name="'q'+q.id" :value="i+1" v-model="userAnswers[q.id]"> {{ opt }}</label></div></div></div></div>
                                    <button @click="submitQuiz(false)" class="btn btn-success w-100 btn-lg mb-5 shadow fw-bold py-3">Submit Final Answers</button>
                                </div>
                             </div>
                        </div>

                        <div class="col-md-3">
                            <div v-if="currentView !== 'playing'">
                                <div class="card shadow-sm border-0 bg-white mb-4 overflow-hidden"><div class="card-header border-0 bg-light py-3 d-flex justify-content-between align-items-center"><span class="fw-bold text-dark">Daily Planner</span><small class="text-muted">UPCOMING</small></div><div class="card-body p-3"><div v-if="upcomingQuizzes.length > 0"><div v-for="q in upcomingQuizzes.slice(0, 3)" :key="q.id" class="p-3 mb-3 border rounded-3 bg-light"><h6 class="mb-1 fw-bold small">{{ q.remarks }}</h6><small class="text-muted d-block mb-2">Chapter: {{ q.chapter_name }}</small><button @click="startQuiz(q.id)" class="btn btn-primary btn-sm w-100 py-1" style="font-size: 0.7rem;">Begin Now</button></div></div><div v-else class="text-center py-4 text-muted small">No pending tests today!</div></div></div>
                                <div class="card shadow-sm border-0 p-4 bg-light text-center small"><div class="mb-2"><span class="text-success h4">✓</span></div><div class="fw-bold">Reminders Active</div><div class="text-muted mt-1">We'll alert you to new quizzes at 6:00 PM daily.</div></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="modal.isVisible" class="modal fade show" style="display: block; background: rgba(0,0,0,0.7);"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg"><div class="modal-header text-white border-0" :class="'bg-'+modal.type"><h5 class="modal-title fw-bold">{{modal.title}}</h5><button class="btn-close btn-close-white shadow-none" @click="closeModal"></button></div><div class="modal-body py-4"><p class="mb-0">{{modal.message}}</p></div><div class="modal-footer border-0 bg-light"><button v-if="modal.onConfirm" class="btn btn-link text-muted text-decoration-none px-4" @click="closeModal">Cancel</button><button class="btn px-5 rounded-pill shadow-sm" :class="'btn-'+modal.type" @click="confirmAction">OK</button></div></div></div></div>

            <div v-if="editContext.isVisible" class="modal fade show" style="display: block; background: rgba(0,0,0,0.5);"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-light border-0"><h5 class="modal-title fw-bold text-capitalize">Edit {{ editContext.type }}</h5><button class="btn-close shadow-none" @click="closeEditModal"></button></div>
                <div class="modal-body py-4">
                    
                    <div v-if="editContext.type === 'student'">
                        <label class="small fw-bold text-muted mb-1">Full Name</label>
                        <input v-model="editContext.payload.full_name" class="form-control mb-3" placeholder="Full Name">
                        <label class="small fw-bold text-muted mb-1">Email</label>
                        <input v-model="editContext.payload.email" type="email" class="form-control mb-3" placeholder="Email Address">
                        <label class="small fw-bold text-muted mb-1">Qualification</label>
                        <input v-model="editContext.payload.qualification" class="form-control mb-3" placeholder="Qualification">
                        <label class="small fw-bold text-muted mb-1">Date of Birth</label>
                        <input v-model="editContext.payload.dob" type="date" class="form-control mb-2">
                    </div>

                    <div v-if="editContext.type === 'subject' || editContext.type === 'chapter'">
                        <label class="small fw-bold text-muted mb-1">Name</label>
                        <input v-model="editContext.payload.name" class="form-control mb-3" placeholder="Name">
                        <label class="small fw-bold text-muted mb-1">Description</label>
                        <input v-model="editContext.payload.description" class="form-control mb-2" placeholder="Description">
                    </div>
                    <div v-if="editContext.type === 'quiz'">
                        <label class="small fw-bold text-muted mb-1">Quiz Title</label>
                        <input v-model="editContext.payload.remarks" class="form-control mb-3" placeholder="Title">
                        <label class="small fw-bold text-muted mb-1">Date of Quiz</label>
                        <input v-model="editContext.payload.date_of_quiz" type="date" class="form-control mb-3">
                        <label class="small fw-bold text-muted mb-1">Duration (Minutes)</label>
                        <input v-model="editContext.payload.time_duration" type="number" class="form-control mb-2" placeholder="Duration">
                    </div>
                    <div v-if="editContext.type === 'question'">
                        <label class="small fw-bold text-muted mb-1">Question Statement</label>
                        <textarea v-model="editContext.payload.question_statement" class="form-control mb-3"></textarea>
                        
                        <div class="row g-2 mb-3">
                            <div class="col-6"><input v-model="editContext.payload.option1" class="form-control form-control-sm" placeholder="Option 1"></div>
                            <div class="col-6"><input v-model="editContext.payload.option2" class="form-control form-control-sm" placeholder="Option 2"></div>
                            <div class="col-6"><input v-model="editContext.payload.option3" class="form-control form-control-sm" placeholder="Option 3"></div>
                            <div class="col-6"><input v-model="editContext.payload.option4" class="form-control form-control-sm" placeholder="Option 4"></div>
                        </div>

                        <label class="small fw-bold text-muted mb-1">Correct Option (1-4)</label>
                        <input v-model="editContext.payload.correct_option" type="number" class="form-control mb-2">
                    </div>
                </div>
                <div class="modal-footer border-0 bg-light"><button class="btn btn-link text-muted text-decoration-none px-4" @click="closeEditModal">Cancel</button><button class="btn btn-primary px-4 rounded-pill shadow-sm" @click="saveEdit">Save Changes</button></div>
            </div></div></div>
        </div>
    `
};

const app = createApp(App);
app.mount('#app');