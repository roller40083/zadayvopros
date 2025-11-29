// Инициализация Supabase
let supabaseClient;

function initializeSupabase() {
    const supabaseUrl = 'https://exinupxmlgedysjozyew.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4aW51cHhtbGdlZHlzam96eWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNTIzNTcsImV4cCI6MjA3OTkyODM1N30.yU2dcrdkk7dtuAcaOBtOu1D8vg_qyYDPiJ33WH4XVZ0';

    console.log('Инициализация Supabase...');

    supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            flowType: 'pkce'
        },
        global: {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        }
    });

    console.log('Supabase инициализирован с заголовками');
    
    // Ждем немного перед проверкой авторизации
    setTimeout(() => {
        checkAuth();
    }, 100);
}

// Проверка авторизации
async function checkAuth() {
    try {
        console.log('Проверка авторизации...');
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Ошибка получения сессии:', error);
            showAuth();
            return;
        }
        
        if (session) {
            console.log('Сессия найдена:', session.user.email);
            showDashboard(session.user);
            await loadUserData(session.user);
        } else {
            console.log('Сессия не найдена');
            showAuth();
        }
    } catch (err) {
        console.error('Ошибка в checkAuth:', err);
        showAuth();
    }
}

// Показываем форму авторизации
function showAuth() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('expert-dashboard-section').classList.add('hidden');
}

// Показываем личный кабинет
function showDashboard(user) {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    document.getElementById('expert-dashboard-section').classList.add('hidden');
    document.getElementById('user-email').textContent = user.email;
}

// Загружаем данные пользователя
async function loadUserData(user) {
    console.log('=== НАЧАЛО loadUserData ===');

    try {
        // Загружаем профиль
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        console.log('Профиль пользователя:', profile);

        if (profile && !error) {
            const firstNameInput = document.getElementById('first-name');
            const lastNameInput = document.getElementById('last-name');
            const specializationSelect = document.getElementById('expert-specialization');
            const bioTextarea = document.getElementById('expert-bio');

            if (firstNameInput && profile.first_name) {
                firstNameInput.value = profile.first_name;
            }
            if (lastNameInput && profile.last_name) {
                lastNameInput.value = profile.last_name;
            }
            if (specializationSelect && profile.expert_specialization) {
                specializationSelect.value = profile.expert_specialization;
            }
            if (bioTextarea && profile.expert_bio) {
                bioTextarea.value = profile.expert_bio;
            }
        }
        await loadUserQuestions(user.id);
        await loadExperts();

        console.log('=== КОНЕЦ loadUserData ===');

    } catch (err) {
        console.error('Ошибка в loadUserData:', err);
    }
}

// Загружаем вопросы пользователя
async function loadUserQuestions(userId) {
    console.log('Загрузка вопросов для пользователя:', userId);
    
    try {
        // Сначала загружаем вопросы
        const { data: questions, error: questionsError } = await supabaseClient
            .from('questions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (questionsError) {
            console.error('Ошибка загрузки вопросов:', questionsError);
            return;
        }

        console.log('Найдено вопросов:', questions?.length);

        if (!questions || questions.length === 0) {
            document.getElementById('questions-list').innerHTML = '<p>У вас пока нет вопросов</p>';
            return;
        }

        // Для каждого вопроса загружаем ответы и информацию об эксперте отдельно
        const questionsWithDetails = await Promise.all(
            questions.map(async (question) => {
                // Загружаем ответы
                const { data: answers, error: answersError } = await supabaseClient
                    .from('answers')
                    .select('*')
                    .eq('question_id', question.id)
                    .order('created_at', { ascending: false });

                // Загружаем информацию об эксперте
                const { data: expert, error: expertError } = await supabaseClient
                    .from('profiles')
                    .select('username, first_name, last_name, expert_specialization')
                    .eq('id', question.expert_id)
                    .single();

                return {
                    ...question,
                    answer: answers && answers.length > 0 ? answers[0] : null,
                    expert: expert || { username: 'Неизвестный эксперт' }
                };
            })
        );

        document.getElementById('questions-count').textContent = questionsWithDetails.length;
        
        const answeredCount = questionsWithDetails.filter(q => q.answer).length;
        document.getElementById('answers-count').textContent = answeredCount;
        
        const questionsList = document.getElementById('questions-list');
        
        questionsList.innerHTML = questionsWithDetails.map(q => {
            const expertName = getExpertDisplayName(q.expert);
            const expertSpecialization = q.expert?.expert_specialization || 'Специализация не указана';
            
            return `
                <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div>
                            <h4 style="margin: 0 0 5px 0;">${q.title}</h4>
                            <div style="color: #666; font-size: 14px;">
                                <strong>👨‍💼 Эксперт:</strong> ${expertName}
                                ${expertSpecialization ? ` | <strong>🎯 Специализация:</strong> ${expertSpecialization}` : ''}
                            </div>
                        </div>
                        <div style="color: #666; font-size: 12px; text-align: right;">
                            ${new Date(q.created_at).toLocaleDateString()}
                        </div>
                    </div>
                    
                    <p><strong>Вопрос:</strong> ${q.description}</p>
                    
                    ${q.answer ? `
                        <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 10px 0;">
                            <h5 style="color: #155724; margin-top: 0;">✅ Ответ эксперта:</h5>
                            <p style="color: #155724; white-space: pre-wrap;">${q.answer.content}</p>
                            <div style="color: #155724; font-size: 12px;">
                                Ответ получен: ${new Date(q.answer.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    ` : q.status === 'paid' ? `
                        <div style="background: #fff3cd; padding: 10px; border-radius: 5px;">
                            ⏳ Эксперт готовит ответ...
                        </div>
                    ` : q.status === 'pending' ? `
                        <div style="background: #f8d7da; padding: 10px; border-radius: 5px;">
                            ❌ Вопрос ожидает оплаты
                        </div>
                    ` : ''}
                    
                    <div style="color: #666; font-size: 14px; margin-top: 10px;">
                        Статус: <strong>${getStatusText(q.status)}</strong> | 
                        Цена: ${q.price / 100} руб
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Ошибка в loadUserQuestions:', err);
    }
}

// Загружаем список экспертов
async function loadExperts() {
    console.log('Загрузка экспертов...');

    try {
        const { data: experts, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('is_expert', true)
            .order('username');

        if (error) {
            console.error('Ошибка загрузки экспертов:', error);
            return;
        }

        const expertsList = document.getElementById('experts-list');

        if (!experts || experts.length === 0) {
            expertsList.innerHTML = '<p>Пока нет доступных экспертов</p>';
            return;
        }

        expertsList.innerHTML = experts.map(expert => `
    <div class="expert-card" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; cursor: pointer;" 
         onclick="selectExpert('${expert.id}', '${getExpertDisplayName(expert)}')">
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
                <h4 style="margin: 0 0 5px 0;">${getExpertDisplayName(expert)}</h4>
                ${expert.expert_specialization ? `
                    <p style="margin: 0; color: #666; font-size: 14px;">
                        🎯 ${expert.expert_specialization}
                    </p>
                ` : ''}
                ${expert.expert_bio ? `
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #555;">${expert.expert_bio}</p>
                ` : ''}
            </div>
            <div style="background: #007bff; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; white-space: nowrap; margin-left: 10px;">
                Выбрать
            </div>
        </div>
    </div>
`).join('');

    } catch (err) {
        console.error('Ошибка в loadExperts:', err);
    }
}

// Функция для отображения специализации
function getSpecializationText(specialization) {
    const specializations = {
        'programming': 'Программирование',
        'design': 'Дизайн',
        'marketing': 'Маркетинг',
        'business': 'Бизнес',
        'law': 'Юриспруденция',
        'psychology': 'Психология'
    };
    return specializations[specialization] || specialization || 'Не указана';
}

// Функция для отображения имени эксперта
function getExpertDisplayName(expert) {
    if (!expert) return 'Неизвестный эксперт';
    if (expert.first_name && expert.last_name) {
        return `${expert.first_name} ${expert.last_name}`;
    } else if (expert.first_name) {
        return expert.first_name;
    } else {
        return expert.username || 'Эксперт';
    }
}

// Выбор эксперта
function selectExpert(expertId, expertDisplayName) {
    document.getElementById('selected-expert-id').value = expertId;
    document.getElementById('selected-expert-name').textContent = expertDisplayName;
    document.getElementById('selected-expert-display').style.display = 'block';
    
    showNotification(`Выбран эксперт: ${expertDisplayName} ✅`, 'success');
    document.getElementById('question-title').focus();
}

// Очистка выбранного эксперта
function clearSelectedExpert() {
    document.getElementById('selected-expert-id').value = '';
    document.getElementById('selected-expert-display').style.display = 'none';
    showNotification('Эксперт отменен', 'info');
}

// Текстовое представление статуса
function getStatusText(status) {
    const statuses = {
        'pending': '⏳ Ожидает оплаты',
        'paid': '💰 Оплачен',
        'answered': '✅ Ответ получен',
        'closed': '❌ Закрыт'
    };
    return statuses[status] || status;
}

// Функции для переключения между вкладками
function showTab(tabName) {
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.remove('active');

    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    document.getElementById(tabName + '-form').classList.add('active');
    event.target.classList.add('active');
}

// Функция для показа сообщений
function showMessage(text, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = type;
    setTimeout(() => {
        messageEl.textContent = '';
        messageEl.className = '';
    }, 5000);
}

// Функция для показа красивых уведомлений
function showNotification(text, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
            <span>${text}</span>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Регистрация
async function signUp() {
    if (!supabaseClient) {
        showMessage('Ошибка: приложение не инициализировано', 'error');
        return;
    }

    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    if (!email || !password) {
        showMessage('Заполните все поля', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
        });

        if (error) {
            showMessage('Ошибка регистрации: ' + error.message, 'error');
        } else {
            showNotification('Регистрация прошла успешно! Проверьте вашу почту для подтверждения. 📧', 'success');
            document.getElementById('register-email').value = '';
            document.getElementById('register-password').value = '';
        }
    } catch (err) {
        showMessage('Произошла ошибка: ' + err.message, 'error');
    }
}

// Вход
async function signIn() {
    if (!supabaseClient) {
        showMessage('Ошибка: приложение не инициализировано', 'error');
        return;
    }

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showMessage('Заполните все поля', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            showMessage('Ошибка входа: ' + error.message, 'error');
        } else {
            showNotification('Вход выполнен успешно! Добро пожаловать! 👋', 'success');
            showDashboard(data.user);
            loadUserData(data.user);
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
        }
    } catch (err) {
        showMessage('Произошла ошибка: ' + err.message, 'error');
    }
}

// Выход
async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        showMessage('Ошибка при выходе: ' + error.message, 'error');
    } else {
        showAuth();
        showNotification('Вы успешно вышли из системы 👋', 'info');
    }
}

// Обновление профиля эксперта
async function updateProfile() {
    console.log('Начало updateProfile');

    const firstName = document.getElementById('first-name').value;
    const lastName = document.getElementById('last-name').value;
    const specialization = document.getElementById('expert-specialization').value;
    const bio = document.getElementById('expert-bio').value;

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        console.error('Ошибка получения пользователя:', userError);
        showNotification('Ошибка: пользователь не авторизован', 'error');
        return;
    }

    try {
        const { data: existingProfile, error: checkError } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();

        let result;
        if (checkError && checkError.code === 'PGRST116') {
            result = await supabaseClient
                .from('profiles')
                .insert({
                    id: user.id,
                    username: user.email.split('@')[0],
                    first_name: firstName,
                    last_name: lastName,
                    expert_specialization: specialization,
                    expert_bio: bio,
                    is_expert: true
                })
                .select();
        } else {
            result = await supabaseClient
                .from('profiles')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    expert_specialization: specialization,
                    expert_bio: bio,
                    is_expert: true,
                    updated_at: new Date()
                })
                .eq('id', user.id)
                .select();
        }

        if (result.error) {
            console.error('Ошибка сохранения профиля:', result.error);
            showNotification('Ошибка сохранения профиля: ' + result.error.message, 'error');
        } else {
            showNotification('Профиль эксперта успешно сохранен! 🎯', 'success');
        }
    } catch (err) {
        console.error('Исключение в updateProfile:', err);
        showNotification('Произошла ошибка: ' + err.message, 'error');
    }
}

// Создание вопроса
async function createQuestion() {
    const title = document.getElementById('question-title').value;
    const description = document.getElementById('question-description').value;
    const price = document.getElementById('question-price').value;
    const expertId = document.getElementById('selected-expert-id').value;

    if (!title || !description || !price || !expertId) {
        showNotification('Заполните все поля и выберите эксперта ❌', 'error');
        return;
    }

    try {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        
        if (userError || !user) {
            showNotification('Ошибка: пользователь не авторизован', 'error');
            return;
        }

        // Проверяем что эксперт существует
        const { data: expert, error: expertError } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('id', expertId)
            .single();

        if (expertError || !expert) {
            showNotification('Ошибка: эксперт не найден ❌', 'error');
            return;
        }

        const { data, error } = await supabaseClient
            .from('questions')
            .insert({
                user_id: user.id,
                expert_id: expertId,
                title: title,
                description: description,
                price: parseInt(price) * 100,
                status: 'pending'
            })
            .select();

        if (error) {
            console.error('Ошибка создания вопроса:', error);
            showNotification('Ошибка создания вопроса: ' + error.message, 'error');
        } else {
            showNotification('Вопрос успешно создан! Теперь его нужно оплатить. 💰', 'success');
            // Очищаем форму
            document.getElementById('question-title').value = '';
            document.getElementById('question-description').value = '';
            document.getElementById('selected-expert-id').value = '';
            document.getElementById('selected-expert-display').style.display = 'none';
            document.getElementById('question-price').value = '500';
            document.getElementById('price-display').textContent = '500';
            loadUserQuestions(user.id);
        }
    } catch (err) {
        console.error('Исключение в createQuestion:', err);
        showNotification('Произошла ошибка: ' + err.message, 'error');
    }
}

// Переключение между режимом пользователя и эксперта
function toggleExpertMode() {
    const dashboard = document.getElementById('dashboard-section');
    const expertDashboard = document.getElementById('expert-dashboard-section');

    if (expertDashboard.classList.contains('hidden')) {
        dashboard.classList.add('hidden');
        expertDashboard.classList.remove('hidden');
        loadExpertData();
    } else {
        expertDashboard.classList.add('hidden');
        dashboard.classList.remove('hidden');
    }
}

// Загрузка данных для эксперта
async function loadExpertData() {
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) return;

    const { data: questions, error } = await supabaseClient
        .from('questions')
        .select('*')
        .eq('expert_id', user.id)
        .order('created_at', { ascending: false });

    if (questions && !error) {
        const expertQuestionsList = document.getElementById('expert-questions-list');
        const expertStats = document.getElementById('expert-stats');

        const totalQuestions = questions.length;
        const paidQuestions = questions.filter(q => q.status === 'paid').length;
        const answeredQuestions = questions.filter(q => q.status === 'answered').length;
        const totalEarnings = questions
            .filter(q => q.status === 'answered')
            .reduce((sum, q) => sum + (q.price / 100), 0);

        expertStats.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${totalQuestions}</div>
                <div class="stat-label">Всего вопросов</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${paidQuestions}</div>
                <div class="stat-label">Ожидают ответа</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${answeredQuestions}</div>
                <div class="stat-label">Ответов дано</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalEarnings} ₽</div>
                <div class="stat-label">Заработано</div>
            </div>
        `;

        if (questions.length === 0) {
            expertQuestionsList.innerHTML = '<p>У вас пока нет вопросов от клиентов</p>';
        } else {
            expertQuestionsList.innerHTML = questions.map(question => `
                <div class="question-item" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
                    <h4>${question.title}</h4>
                    <p>${question.description}</p>
                    <div style="color: #666; font-size: 14px; margin: 10px 0;">
                        <strong>Статус:</strong> ${getStatusText(question.status)} | 
                        <strong>Цена:</strong> ${question.price / 100} руб |
                        <strong>Дата:</strong> ${new Date(question.created_at).toLocaleDateString()}
                    </div>
                    ${question.status === 'paid' ? `
                        <div class="answer-section">
                            <textarea id="answer-${question.id}" placeholder="Ваш ответ на вопрос..." rows="4" style="width: 100%; margin: 10px 0;"></textarea>
                            <button onclick="submitAnswer(${question.id})" style="background: #28a745;">Отправить ответ</button>
                        </div>
                    ` : ''}
                    ${question.status === 'answered' ? `
                        <div style="background: #d4edda; padding: 10px; border-radius: 5px; margin-top: 10px;">
                            <strong>✅ Ваш ответ отправлен</strong>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }
    }
}

// Отправка ответа на вопрос
async function submitAnswer(questionId) {
    const answerText = document.getElementById(`answer-${questionId}`).value;

    if (!answerText) {
        showNotification('Введите ответ на вопрос ❌', 'error');
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();

    try {
        const { data: answer, error: answerError } = await supabaseClient
            .from('answers')
            .insert({
                question_id: questionId,
                expert_id: user.id,
                content: answerText
            })
            .select();

        if (answerError) throw answerError;

        const { error: questionError } = await supabaseClient
            .from('questions')
            .update({
                status: 'answered',
                updated_at: new Date()
            })
            .eq('id', questionId);

        if (questionError) throw questionError;

        showNotification('Ответ успешно отправлен! 💰', 'success');

        setTimeout(() => {
            loadExpertData();
        }, 1000);

    } catch (error) {
        console.error('Ошибка при отправке ответа:', error);
        showNotification('Ошибка при отправке ответа: ' + error.message, 'error');
    }
}

// Привязываем обработчики событий после загрузки DOM
document.addEventListener('DOMContentLoaded', function () {
    initializeSupabase();

    document.getElementById('update-profile-btn').addEventListener('click', updateProfile);
    document.getElementById('create-question-btn').addEventListener('click', createQuestion);

    document.getElementById('question-price').addEventListener('input', function () {
        document.getElementById('price-display').textContent = this.value;
    });
});

// Слушаем изменения авторизации
supabaseClient?.auth.onAuthStateChange((event, session) => {
    console.log('Изменение авторизации:', event, session);
    if (event === 'SIGNED_IN' && session) {
        showDashboard(session.user);
        loadUserData(session.user);
    } else if (event === 'SIGNED_OUT') {
        showAuth();
    }
});