const API_BASE_URL = 'http://127.0.0.1:5000';
const config = {
    numberOfActivities: 10
};

// Funções de serviço para interagir com a API
async function fetchFromApi(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
    };
    const config = {
        method,
        headers,
    };
    if (body) {
        config.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        if (!response.ok) {
            throw new Error(`Erro HTTP! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Erro na requisição para ${endpoint}:`, error);
        showGlobalMessageModal('Erro de Rede', `Não foi possível conectar ao servidor. Detalhes: ${error.message}`);
        throw error;
    }
}

async function fetchClasses() {
    return fetchFromApi('/classes');
}

async function fetchStudents() {
    return fetchFromApi('/alunos');
}

async function fetchAttendanceRecords() {
    return fetchFromApi('/attendance');
}

async function saveAttendanceRecords(recordData) {
    return fetchFromApi('/attendance/add', 'POST', recordData);
}

async function fetchStudentActivities() {
    return fetchFromApi('/atividades_alunos');
}

async function updateActivityStatus(alunoId, data) {
    return fetchFromApi(`/atividades_alunos/update_aula/${alunoId}`, 'PUT', data);
}

async function fetchSystemConfig() {
    return fetchFromApi('/config');
}

// Funções globais de UI
function showLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

function showGlobalMessageModal(title, message) {
    document.getElementById('globalMessageModalTitle').textContent = title;
    document.getElementById('globalMessageModalText').textContent = message;
    document.getElementById('globalMessageModal').classList.remove('hidden');
}

function closeGlobalMessageModal() {
    document.getElementById('globalMessageModal').classList.add('hidden');
}

function showConfirmModal(title, message, onConfirmCallback) {
    const confirmModal = document.getElementById('confirmModal');
    const confirmModalTitle = document.getElementById('confirmModalTitle');
    const confirmModalText = document.getElementById('confirmModalText');
    const doConfirmBtn = document.getElementById('doConfirmModalBtn');
    const cancelConfirmBtn = document.getElementById('cancelConfirmModalBtn');
    
    confirmModalTitle.textContent = title;
    confirmModalText.textContent = message;
    
    // Remove listeners antigos para evitar múltiplas chamadas
    doConfirmBtn.onclick = null;
    cancelConfirmBtn.onclick = null;

    // Define os novos listeners
    doConfirmBtn.onclick = () => {
      onConfirmCallback();
      closeConfirmModal();
    };

    cancelConfirmBtn.onclick = () => {
      closeConfirmModal();
    };
    
    confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
}


// REMOÇÃO: A base de dados de usuários e as funções addUser/loadUsers hardcoded não são mais necessárias, pois o login e gerenciamento de usuários agora são feitos pelo backend.
// const users = { ... }
// function addUser(username, password, role = "student", name = "") { { ... } }
// function loadUsers() { ... }


document.addEventListener("DOMContentLoaded", () => {
  // REMOÇÃO: loadUsers() não é mais necessário aqui, pois o login será via API.
  // loadUsers()

  const loginForm = document.getElementById("loginForm");

  // ADIÇÃO: Elementos e funções globais para feedback visual
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'loading-overlay hidden';
  loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
  document.body.appendChild(loadingOverlay);

  // Estas funções window.showLoading e window.hideLoading já foram definidas acima.

  const messageModalHtml = `
      <div id="globalMessageModal" class="message-modal hidden">
          <div class="modal-content">
              <div class="modal-header">
                  <h3 id="globalMessageModalTitle"></h3>
                  <button class="close-btn" onclick="closeGlobalMessageModal()">×</button>
              </div>
              <div class="modal-body">
                  <p id="globalMessageModalText"></p>
              </div>
              <div class="modal-footer">
                  <button class="action-btn primary" onclick="closeGlobalMessageModal()">OK</button>
              </div>
          </div>
      </div>`;
  document.body.insertAdjacentHTML('beforeend', messageModalHtml);

  // ADIÇÃO: Novo modal de confirmação com 2 botões
  const confirmModalHtml = `
      <div id="confirmModal" class="modal hidden">
          <div class="modal-content">
              <div class="modal-header">
                  <h3 id="confirmModalTitle"></h3>
                  <button class="close-btn" onclick="closeConfirmModal()">×</button>
              </div>
              <div class="modal-body">
                  <p id="confirmModalText"></p>
              </div>
              <div class="modal-footer">
                  <button class="action-btn secondary" id="cancelConfirmModalBtn">Cancelar</button>
                  <button class="action-btn primary" id="doConfirmModalBtn">Confirmar</button>
              </div>
          </div>
      </div>`;
  document.body.insertAdjacentHTML('beforeend', confirmModalHtml);


  // Estas funções window.showGlobalMessageModal e window.closeGlobalMessageModal já foram definidas acima.
  // Estas funções window.showConfirmModal e window.closeConfirmModal já foram definidas acima.


  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => { // MODIFICAÇÃO: Adicionado 'async'
      e.preventDefault();

      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;

      showLoading(); // ADIÇÃO: Mostra o spinner

      try {
        // ADIÇÃO: Requisição para o endpoint de login do backend
        const response = await fetch('http://127.0.0.1:5000/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        });

        const data = await response.json(); // Esta é a resposta do backend

        console.log("Resposta completa do backend:", data); // ADIÇÃO PARA DEBUG
        console.log("data.success é:", data.success); // ADIÇÃO PARA DEBUG

        if (data.success) { // Esta condição deve ser verdadeira se o login for bem-sucedido
          console.log("Login no frontend reconhecido como SUCESSO. Tentando redirecionar..."); // ADIÇÃO PARA DEBUG

          // MODIFICAÇÃO: Armazenar dados do usuário do backend no localStorage
          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("userId", data.user.id);
          localStorage.setItem("username", data.user.username);
          localStorage.setItem("userRole", data.user.role); // Role é definida aqui
          localStorage.setItem("userName", data.user.full_name); // MODIFICAÇÃO: Agora 'full_name' do backend
          localStorage.setItem("userStudentId", data.user.student_id);

          // Redirecionar baseado no papel do usuário
          // MODIFICAÇÃO: Simplifica a condição para apenas 'teacher', já que admins são agora teachers
          if (data.user.role === "teacher") {
            console.log("Redirecionando para teacher-dashboard.html"); // ADIÇÃO PARA DEBUG
            window.location.href = "teacher-dashboard.html";
          } else {
            console.log("Redirecionando para dashboard.html"); // ADIÇÃO PARA DEBUG
            window.location.href = "dashboard.html";
          }
        } else {
          showGlobalMessageModal('Erro no Login', data.message || 'Erro desconhecido.'); // MODIFICAÇÃO: Mensagem de erro mais robusta
        }
      } catch (error) {
        console.error('Erro de rede ou servidor ao tentar logar:', error);
        showGlobalMessageModal('Erro de Conexão', 'Erro de conexão ou servidor. Tente novamente mais tarde.');
      } finally {
        hideLoading(); // ADIÇÃO: Esconde o spinner
      }
    });
  }

  // Check if user is logged in
  const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname === "/";

  if (!isLoginPage && !localStorage.getItem("isLoggedIn")) {
    window.location.href = "index.html"; // Apenas redireciona se NÃO estiver logado
  }

  // ADIÇÃO: Lógica de Redirecionamento por Perfil (NOVA LÓGICA CENTRAL)
  const userRole = localStorage.getItem("userRole");
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  const currentPage = window.location.pathname.split('/').pop(); // Obtém apenas o nome do arquivo da URL

  if (isLoggedIn === 'true') {
      // Páginas que são estritamente do professor (não devem ser acessadas por alunos)
      const strictTeacherPages = ['teacher-dashboard.html', 'admin.html', 'database.html', 'teacher-diary.html', 'teacher-activities.html', 'teacher-materials.html'];
      // Páginas que são estritamente do aluno (não devem ser acessadas por professores)
      const strictStudentPages = ['dashboard.html'];

      if (userRole === 'teacher') {
          // Se um professor está em uma página estritamente de aluno, redireciona para a dashboard do professor
          if (strictStudentPages.includes(currentPage)) {
              console.log("Professor em página de aluno, redirecionando para dashboard do professor.");
              window.location.href = "teacher-dashboard.html";
          }
      } else if (userRole === 'student') {
          // Se um aluno está em uma página estritamente de professor, redireciona para a dashboard do aluno
          if (strictTeacherPages.includes(currentPage)) {
              console.log("Aluno em página de professor, redirecionando para dashboard do aluno.");
              window.location.href = "dashboard.html";
          }
      }
  }


  // ADIÇÃO: Lógica para mostrar/esconder links de navegação com base no perfil
  // Nota: Estes IDs devem estar presentes no HTML dos cabeçalhos que você quer controlar.
  // No cabeçalho UNIFICADO, coloque TODOS os links de aluno e professor com IDs únicos.

  const navAdmin = document.getElementById('navAdmin'); // ID para Administração de Usuários
  const navBancoDados = document.getElementById('navBancoDados');
  const navDiarioClasseProf = document.getElementById('navDiarioClasseProf');
  const navActivitiesProf = document.getElementById('navActivitiesProf');
  const navMateriaisProf = document.getElementById('navMateriaisProf');

  const navDiarioClasseAluno = document.getElementById('navDiarioClasseAluno'); // ID para Diário de Classe do Aluno
  const navMateriaisAluno = document.getElementById('navMateriaisAluno'); // ID para Materiais do Aluno

  if (userRole === 'teacher') {
      // Mostrar links de Professor
      if (navAdmin) navAdmin.style.display = 'list-item'; // Use 'list-item' para garantir que o estilo de lista seja aplicado
      if (navBancoDados) navBancoDados.style.display = 'list-item';
      if (navDiarioClasseProf) navDiarioClasseProf.style.display = 'list-item';
      if (navActivitiesProf) navActivitiesProf.style.display = 'list-item';
      if (navMateriaisProf) navMateriaisProf.style.display = 'list-item';

      // Ocultar links de Aluno
      if (navDiarioClasseAluno) navDiarioClasseAluno.style.display = 'none';
      if (navMateriaisAluno) navMateriaisAluno.style.display = 'none';
      
      // Remova qualquer ID 'adminLink' antigo ou duplicado
      const oldAdminLink = document.getElementById('adminLink');
      if (oldAdminLink) {
        oldAdminLink.style.display = 'none';
      }

  } else if (userRole === 'student') {
      // Ocultar links de Professor
      if (navAdmin) navAdmin.style.display = 'none';
      if (navBancoDados) navBancoDados.style.display = 'none';
      if (navDiarioClasseProf) navDiarioClasseProf.style.display = 'none';
      if (navActivitiesProf) navActivitiesProf.style.display = 'none';
      if (navMateriaisProf) navMateriaisProf.style.display = 'none';

      // Mostrar links de Aluno
      if (navDiarioClasseAluno) navDiarioClasseAluno.style.display = 'list-item';
      if (navMateriaisAluno) navMateriaisAluno.style.display = 'list-item';

      // Remova qualquer ID 'adminLink' antigo ou duplicado
      const oldAdminLink = document.getElementById('adminLink');
      if (oldAdminLink) {
        oldAdminLink.style.display = 'none';
      }
  }


  // --- Funções para buscar e exibir os alunos do backend (info_alunos) ---
  window.fetchAlunosFromBackend = async function() { // MODIFICAÇÃO: Tornada global e async
    showLoading(); // ADIÇÃO
      try {
          const response = await fetch('http://127.0.0.1:5000/alunos');
          if (!response.ok) {
              throw new Error(`Erro HTTP! Status: ${response.status}`);
          }
          let alunos = await response.json(); // Use 'let' para que possa ser reatribuído
          
          // ADIÇÃO DE LOG E ORDENAÇÃO NO FRONTEND
          console.log('Alunos recebidos do backend (antes da ordenação no frontend):', alunos);
          alunos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
          console.log('Alunos após ordenação no frontend:', alunos);

          displayAlunosInInfoTable(alunos);
      } catch (error) {
          console.error('Erro ao buscar alunos do backend:', error);
          const tbody = document.querySelector('#table_info_alunos tbody');
          if (tbody) {
              tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: red;">Erro ao carregar dados dos alunos.</td></tr>`;
          }
          showGlobalMessageModal('Erro', 'Não foi possível carregar os dados dos alunos.'); // ADIÇÃO
      } finally {
        hideLoading(); // ADIÇÃO
      }
  }

  // --- Função para popular a tabela de info_alunos em database.html ---
  function displayAlunosInInfoTable(alunos) {
      const tbody = document.querySelector('#table_info_alunos tbody');
      
      if (!tbody) {
          console.warn('Elemento tbody da tabela de info_alunos não encontrado. Verifique database.html.');
          return;
      }

      tbody.innerHTML = ''; // Limpa as linhas existentes

      if (alunos.length === 0) {
          const noDataRow = document.createElement('tr');
          noDataRow.innerHTML = `<td colspan="12" style="text-align: center;">Nenhum aluno encontrado.</td>`; 
          tbody.appendChild(noDataRow);
          return;
      }

      alunos.forEach(aluno => {
          const row = document.createElement('tr');
          row.innerHTML = `
              <td>${aluno.turma || ''}</td>
              <td>${aluno.nome || ''}</td>
              <td>${aluno.email || ''}</td>
              <td>${aluno.telefone || ''}</td>
              <td>${aluno.data_nascimento || ''}</td>
              <td>${aluno.rg || ''}</td>
              <td>${aluno.cpf || ''}</td>
              <td>${aluno.endereco || ''}</td>
              <td>${aluno.escolaridade || ''}</td>
              <td>${aluno.escola || ''}</td>
              <td>${aluno.responsavel || ''}</td>
              <td>
                  <button class="action-btn small" onclick="editAluno(${aluno.id})" title="Editar">✏️</button>
                  <button class="action-btn small danger" onclick="deleteAluno(${aluno.id})" title="Excluir">🗑️</button>
              </td>
          `;
          tbody.appendChild(row);
      });
  }

  // ADIÇÃO: Funções para buscar e exibir o status geral dos alunos (student_overall_status)
  // NOTA: Esta função foi atualizada para buscar da nova tabela 'status_alunos'
  window.fetchStudentOverallStatusFromBackend = async function() {
    showLoading(); // ADIÇÃO
      try {
          const response = await fetch('http://127.0.0.1:5000/status_alunos'); // MODIFICAÇÃO: Nova rota
          if (!response.ok) {
              throw new Error(`Erro HTTP! Status: ${response.status}`);
          }
          let statuses = await response.json(); // Use 'let'
          // ORDENAÇÃO: Ordenar status por nome do aluno em ordem alfabética
          statuses.sort((a, b) => a.student_name.localeCompare(b.student_name, 'pt-BR', { sensitivity: 'base' }));
          console.log('Status dos alunos carregados do backend (ordenado):', statuses);

          displayStudentOverallStatusTable(statuses);
      } catch (error) {
          console.error('Erro ao buscar status dos alunos do backend:', error);
          const tbody = document.querySelector('#table_status_alunos tbody');
          if (tbody) {
              tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Erro ao carregar status dos alunos.</td></tr>`;
          }
          showGlobalMessageModal('Erro', 'Não foi possível carregar o status dos alunos.'); // ADIÇÃO
      } finally {
        hideLoading(); // ADIÇÃO
      }
  }

  // NOTA: Esta função foi atualizada para exibir dados da nova tabela 'status_alunos'
  function displayStudentOverallStatusTable(statuses) {
      const tbody = document.querySelector('#table_status_alunos tbody');
      if (!tbody) {
          console.warn('Elemento tbody da tabela de status_alunos não encontrado.');
          return;
      }
      tbody.innerHTML = '';
      if (statuses.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Nenhum status de aluno encontrado.</td></tr>`;
          return;
      }

      statuses.forEach(status => {
          const row = document.createElement('tr');
          row.innerHTML = `
              <td>${status.student_name || ''}</td>
              <td>${status.faltas || 0}</td>
              <td>${status.situacao || ''}</td>
              <td>-</td> <td>-</td> `;
          tbody.appendChild(row);
      });
  }


  // ADIÇÃO: Funções para buscar e exibir os dados de login dos usuários (users)
  window.fetchLoginAlunosFromBackend = async function() {
    showLoading(); // ADIÇÃO
      try {
          const response = await fetch('http://127.0.0.1:5000/users');
          if (!response.ok) {
              throw new Error(`Erro HTTP! Status: ${response.status}`);
          }
          let users = await response.json(); // Use 'let'
          // ORDENAÇÃO: Ordenar usuários por nome completo em ordem alfabética
          users.sort((a, b) => (a.full_name || '').localeCompare((b.full_name || ''), 'pt-BR', { sensitivity: 'base' }));
          console.log('Usuários de login carregados do backend (ordenado):', users);

          displayLoginAlunosTable(users);
      } catch (error) {
          console.error('Erro ao buscar usuários de login do backend:', error);
          const tbody = document.querySelector('#table_login_alunos tbody');
          if (tbody) {
              tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Erro ao carregar dados de login.</td></tr>`;
          }
          showGlobalMessageModal('Erro', 'Não foi possível carregar os dados de login.'); // ADIÇÃO
      } finally {
        hideLoading(); // ADIÇÃO
      }
  }

  function displayLoginAlunosTable(users) {
      const tbody = document.querySelector('#table_login_alunos tbody');
      if (!tbody) {
          console.warn('Elemento tbody da tabela de login_alunos não encontrado.');
          return;
      }
      tbody.innerHTML = '';
      if (users.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Nenhum usuário de login encontrado.</td></tr>`;
          return;
      }

      users.forEach(user => {
          const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString('pt-BR') : '';
          const row = document.createElement('tr');
          row.innerHTML = `
              <td>${user.username || ''}</td>
              <td>${user.full_name || ''}</td>
              <td>${lastLogin}</td>
              <td>${user.total_logins !== null ? user.total_logins : ''}</td>
              <td>${user.online_status || ''}</td>
          `;
          tbody.appendChild(row);
      });
  }

  // ADIÇÃO: Funções para buscar e exibir os dados das atividades dos alunos (atividades_alunos)
  window.fetchAtividadesAlunosFromBackend = async function() {
    showLoading(); // ADIÇÃO
    try {
        const response = await fetch('http://127.0.0.1:5000/atividades_alunos'); // Nova rota para atividades
        if (!response.ok) {
            throw new Error(`Erro HTTP! Status: ${response.status}`);
        }
        let atividades = await response.json(); // Use 'let'
        // ORDENAÇÃO: Ordenar atividades por nome do aluno em ordem alfabética
        atividades.sort((a, b) => (a.student_name || '').localeCompare((b.student_name || ''), 'pt-BR', { sensitivity: 'base' }));
        console.log('Atividades dos alunos carregadas do backend (ordenado):', atividades);

        displayAtividadesAlunosTable(atividades);
    } catch (error) {
        console.error('Erro ao buscar atividades dos alunos do backend:', error);
        const tbody = document.querySelector('#table_atividades_alunos tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: red;">Erro ao carregar atividades dos alunos.</td></tr>`;
        }
        showGlobalMessageModal('Erro', 'Não foi possível carregar as atividades dos alunos.'); // ADIÇÃO
    } finally {
        hideLoading(); // ADIÇÃO
    }
  }

  function displayAtividadesAlunosTable(atividades) {
      const tbody = document.querySelector('#table_atividades_alunos tbody');
      if (!tbody) {
          console.warn('Elemento tbody da tabela de atividades_alunos não encontrado.');
          return;
      }
      tbody.innerHTML = '';
      if (atividades.length === 0) {
          tbody.innerHTML = `<tr><td colspan="12" style="text-align: center;">Nenhuma atividade de aluno encontrada.</td></tr>`;
          return;
      }

      atividades.forEach(atividade => {
          const row = document.createElement('tr');
          // Construir dinamicamente as colunas de aula
          let aulasHtml = '';
          for (let i = 1; i <= 10; i++) {
              const aulaKey = `aula_${i}`;
              aulasHtml += `<td>${atividade[aulaKey] || 'Pendente'}</td>`;
          }

          row.innerHTML = `
              <td>${atividade.student_name || ''}</td>
              ${aulasHtml}
              <td>${atividade.total_enviadas !== null ? atividade.total_enviadas : ''}</td>
              <td>
                  </td>
          `;
          tbody.appendChild(row);
      });
  }


  // --- Chamada inicial para carregar os alunos (info_alunos) se estiver na página database.html ---
  if (window.location.pathname.endsWith('database.html')) {
      fetchAlunosFromBackend();
  }


  // ADIÇÃO: Função de validação de formulário (Adicionar e Editar Aluno)
  function validateAlunoForm(alunoData, isEdit = false) {
      // Validação de campos obrigatórios e ENUMs (selects)
      if (!alunoData.turma) {
          showGlobalMessageModal('Atenção', 'Campo "Turma" é obrigatório.'); // MODIFICAÇÃO
          return false;
      }
      if (!alunoData.nome) {
          showGlobalMessageModal('Atenção', 'Campo "Nome" é obrigatório.'); // MODIFICAÇÃO
          return false;
      }
      if (!alunoData.cpf) { // CPF é obrigatório
          showGlobalMessageModal('Atenção', 'Campo "CPF" é obrigatório.'); // MODIFICAÇÃO
          return false;
      }
      if (!alunoData.responsavel) { // Responsável é obrigatório
          showGlobalMessageModal('Atenção', 'Campo "Responsável" é obrigatório.'); // MODIFICAÇÃO
          return false;
      }
      if (!alunoData.escolaridade) {
          showGlobalMessageModal('Atenção', 'Campo "Escolaridade" é obrigatório.'); // MODIFICAÇÃO
          return false;
      }
      if (!alunoData.escola) {
          showGlobalMessageModal('Atenção', 'Campo "Escola" é obrigatório.'); // MODIFICAÇÃO
          return false;
      }
      // Data de nascimento é obrigatória apenas na adição, se não for edição e campo for vazio
      if (!isEdit && !alunoData.data_nascimento) {
          showGlobalMessageModal('Atenção', 'Campo "Data de Nascimento" é obrigatório.'); // MODIFICAÇÃO
          return false;
      }


      // REGRA: nome (até 70 caracteres; não deve receber números ou símbolos)
      if (alunoData.nome.length > 70) {
          showGlobalMessageModal('Atenção', 'Campo "Nome" deve ter no máximo 70 caracteres.'); // MODIFICAÇÃO
          return false;
      }
      // Verifica se contém números ou símbolos (permite acentuação e espaços)
      if (/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(alunoData.nome)) {
          showGlobalMessageModal('Atenção', 'Campo "Nome" não deve conter números ou símbolos.'); // MODIFICAÇÃO
          return false;
      }

      // REGRA: email (até 50 caracteres)
      if (alunoData.email && alunoData.email.length > 50) {
          showGlobalMessageModal('Atenção', 'Campo "Email" deve ter no máximo 50 caracteres.'); // MODIFICAÇÃO
          return false;
      }
      // REGRA: email (formato básico de email)
      if (alunoData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alunoData.email)) {
          showGlobalMessageModal('Atenção', 'Campo "Email" inválido. Por favor, insira um formato de email válido.'); // MODIFICAÇÃO
          return false;
      }

      // REGRA: telefone (até 11 números; receber apenas números)
      if (alunoData.telefone && !/^[0-9]{0,11}$/.test(alunoData.telefone)) {
          showGlobalMessageModal('Atenção', 'Campo "Telefone" deve conter apenas números e ter no máximo 11 dígitos.'); // MODIFICAÇÃO
          return false;
      }

      // REGRA: rg (7 a 9 números; receber apenas números)
      if (alunoData.rg && !/^[0-9]{7,9}$/.test(alunoData.rg)) {
          showGlobalMessageModal('Atenção', 'Campo "RG" deve conter apenas números e ter entre 7 e 9 dígitos.'); // MODIFICAÇÃO
          return false;
      }

      // REGRA: cpf (11 números; receber apenas números)
      if (alunoData.cpf && !/^[0-9]{11}$/.test(alunoData.cpf)) {
          showGlobalMessageModal('Atenção', 'Campo "CPF" deve conter apenas números e ter 11 dígitos.'); // MODIFICAÇÃO
          return false;
      }

      // REGRA: endereco (até 100 caracteres)
      if (alunoData.endereco && alunoData.endereco.length > 100) {
          showGlobalMessageModal('Atenção', 'Campo "Endereço" deve ter no máximo 100 caracteres.'); // MODIFICAÇÃO
          return false;
      }

      // REGRA: responsavel (até 70 caracteres; não deve receber números ou símbolos)
      if (alunoData.responsavel.length > 70) {
          showGlobalMessageModal('Atenção', 'Campo "Responsável" deve ter no máximo 70 caracteres.'); // MODIFICAÇÃO
          return false;
      }
      // Verifica se contém números ou símbolos (permite acentuação e espaços)
      if (/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(alunoData.responsavel)) {
          showGlobalMessageModal('Atenção', 'Campo "Responsável" não deve conter números ou símbolos.'); // MODIFICAÇÃO
          return false;
      }
      
      return true; // Se todas as validações passarem
  }


  // --- LÓGICA PARA ADICIONAR ALUNO ---
  window.addRecord = function() {
      const selectedTable = document.getElementById('tableSelect').value;
      if (selectedTable === 'info_alunos') {
          document.getElementById('addAlunoModal').classList.remove('hidden');
      } else {
          // MODIFICAÇÃO: Lógica para adicionar em outras tabelas, se necessário
          // Por exemplo, para classes, atividades, etc.
          showGlobalMessageModal('Atenção', `Funcionalidade de adicionar ainda não implementada para a tabela: ${selectedTable}`); // MODIFICAÇÃO
      }
  }
  
  window.closeAddAlunoModal = function() {
      document.getElementById('addAlunoModal').classList.add('hidden');
      document.getElementById('addAlunoForm').reset();
  }

  const addAlunoForm = document.getElementById('addAlunoForm');
  if (addAlunoForm) {
      addAlunoForm.addEventListener('submit', async function(event) { // MODIFICAÇÃO: Adicionado 'async'
          event.preventDefault();

          const formData = new FormData(addAlunoForm);
          const alunoData = {};
          for (let [key, value] of formData.entries()) {
              alunoData[key] = value;
          }
          console.log('Dados do novo aluno a serem enviados:', alunoData);
          await sendAlunoToBackend(alunoData); // MODIFICAÇÃO: Adicionado 'await'
      });
  }

  // MODIFICAÇÃO: sendAlunoToBackend agora inclui validação e exibe credenciais
  async function sendAlunoToBackend(alunoData) {
    showLoading(); // ADIÇÃO
      // ADIÇÃO: Chamar a função de validação antes de enviar
      if (!validateAlunoForm(alunoData, false)) { // 'false' porque é uma nova adição
        hideLoading(); // ADIÇÃO
          return; // Impede o envio se a validação falhar
      }

      try {
          const response = await fetch('http://127.0.0.1:5000/alunos/add', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify(alunoData),
          });
          const data = await response.json();
          console.log('Resposta do backend:', data);
          if (data.success) {
              let successMessage = 'Aluno adicionado com sucesso!';
              // ADIÇÃO: Exibe também usuário e senha gerados pelo backend
              if (data.generated_username && data.generated_password) {
                  successMessage += `\n\nCredenciais de Login:\nUsuário: ${data.generated_username}\nSenha: ${data.generated_password}`;
              }
              showGlobalMessageModal('Sucesso', successMessage); // MODIFICAÇÃO
              closeAddAlunoModal();
              fetchAlunosFromBackend(); // Recarrega a tabela
          } else {
              // Adiciona detalhes da mensagem de erro do backend (ex: erro de duplicidade)
              showGlobalMessageModal('Erro ao adicionar aluno', data.message || 'Erro desconhecido.'); // MODIFICAÇÃO
          }
      } catch (error) {
          console.error('Erro de rede ou servidor ao enviar aluno:', error);
          showGlobalMessageModal('Erro de Conexão', 'Erro de conexão ou servidor. Tente novamente mais tarde.'); // MODIFICAÇÃO
      } finally {
        hideLoading(); // ADIÇÃO
      }
  }


  // --- LÓGICA PARA DELETAR ALUNO ---
  window.deleteAluno = async function(alunoId) { // MODIFICAÇÃO: Adicionado 'async'
      showConfirmModal('Confirmar Exclusão', `Tem certeza que deseja excluir o aluno com ID ${alunoId}?`, async () => {
          showLoading(); // ADIÇÃO
          try {
              const response = await fetch(`http://127.0.0.1:5000/alunos/delete/${alunoId}`, {
                  method: 'DELETE',
              });
              const data = await response.json();
              console.log('Resposta do backend (delete):', data);
              if (data.success) {
                  showGlobalMessageModal('Sucesso', 'Aluno excluído com sucesso!'); // MODIFICAÇÃO
                  fetchAlunosFromBackend(); // Recarrega a tabela
              } else {
                  showGlobalMessageModal('Erro ao excluir aluno', data.message || 'Erro desconhecido.'); // MODIFICAÇÃO
              }
          } catch (error) {
              console.error('Erro de rede ou servidor ao excluir aluno:', error);
              showGlobalMessageModal('Erro de Conexão', 'Erro de conexão ou servidor ao tentar excluir aluno.'); // MODIFICAÇÃO
          } finally {
            hideLoading(); // ADIÇÃO
          }
      });
  };


  // --- LÓGICA PARA EDITAR ALUNO ---

  // Função para abrir o modal de edição e preencher com os dados do aluno
  window.editAluno = async function(alunoId) { // MODIFICAÇÃO: Adicionado 'async'
    showLoading(); // ADIÇÃO
      try {
          const response = await fetch(`http://127.0.0.1:5000/alunos/${alunoId}`);
          if (!response.ok) {
              throw new Error(`Erro HTTP! Status: ${response.status}`);
          }
          const aluno = await response.json();
          if (aluno) {
              document.getElementById('editAlunoId').value = aluno.id;
              document.getElementById('editTurma').value = aluno.turma || '';
              document.getElementById('editNome').value = aluno.nome || '';
              document.getElementById('editEmail').value = aluno.email || '';
              document.getElementById('editTelefone').value = aluno.telefone || '';
              document.getElementById('editDataNascimento').value = aluno.data_nascimento || '';
              document.getElementById('editRg').value = aluno.rg || '';
              document.getElementById('editCpf').value = aluno.cpf || '';
              document.getElementById('editEndereco').value = aluno.endereco || '';
              document.getElementById('editEscolaridade').value = aluno.escolaridade || '';
              document.getElementById('editEscola').value = aluno.escola || '';
              document.getElementById('editResponsavel').value = aluno.responsavel || '';

              document.getElementById('editAlunoModal').classList.remove('hidden');
          } else {
              showGlobalMessageModal('Erro', 'Aluno não encontrado para edição.'); // MODIFICAÇÃO
          }
      } catch (error) {
          console.error('Erro ao buscar dados do aluno para edição:', error);
          showGlobalMessageModal('Erro', 'Erro ao carregar dados do aluno para edição.'); // MODIFICAÇÃO
      } finally {
        hideLoading(); // ADIÇÃO
      }
  };

  // Função para fechar o modal de edição
  window.closeEditAlunoModal = function() {
      document.getElementById('editAlunoModal').classList.add('hidden');
      document.getElementById('editAlunoForm').reset();
  };

  // Lógica para enviar o formulário de edição
  const editAlunoForm = document.getElementById('editAlunoForm');
  if (editAlunoForm) {
      editAlunoForm.addEventListener('submit', async function(event) { // MODIFICAÇÃO: Adicionado 'async'
          event.preventDefault();

          const formData = new FormData(editAlunoForm);
          const alunoData = {};
          for (let [key, value] of formData.entries()) {
              // Formate a data de nascimento se for o caso
              if (key === 'data_nascimento' && value) {
                  // O input type="date" já retorna "YYYY-MM-DD", que é o formato necessário para MySQL DATE
                  alunoData[key] = value;
              } else {
                  alunoData[key] = value;
              }
          }

          const alunoId = alunoData.id; // Pega o ID do aluno do campo oculto
          delete alunoData.id; // Remove o ID do objeto de dados, pois ele vai na URL da API

          // ADIÇÃO: Chamar a função de validação antes de enviar
          if (!validateAlunoForm(alunoData, true)) { // 'true' porque é uma edição
              return; // Impede o envio se a validação falhar
          }

          console.log('Dados do aluno a serem atualizados:', alunoData, 'ID:', alunoId);

          // Chame a função para enviar os dados editados para o backend
          await sendEditedAlunoToBackend(alunoId, alunoData); // MODIFICAÇÃO: Adicionado 'await'
      });
  }

  // FUNÇÃO sendEditedAlunoToBackend
  async function sendEditedAlunoToBackend(alunoId, alunoData) { // MODIFICAÇÃO: Adicionado 'async'
    showLoading(); // ADIÇÃO
      try {
          const response = await fetch(`http://127.0.0.1:5000/alunos/edit/${alunoId}`, { // A URL do seu endpoint Flask (método PUT)
              method: 'PUT', // Método HTTP PUT para atualização
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify(alunoData), // Converte o objeto JavaScript em uma string JSON
          });
          const data = await response.json(); // Espera uma resposta JSON do backend
          console.log('Resposta do backend (edição):', data);
          if (data.success) {
                      showGlobalMessageModal('Sucesso', 'Aluno atualizado com sucesso!'); // MODIFICAÇÃO
                      closeEditAlunoModal(); // Fecha o modal
                      fetchAlunosFromBackend(); // Recarrega a tabela para mostrar o aluno atualizado
                  } else {
                      // Adiciona detalhes da mensagem de erro do backend (ex: erro de duplicidade)
                      showGlobalMessageModal('Erro ao atualizar aluno', data.message || 'Erro desconhecido.'); // MODIFICAÇÃO
                  }
              } catch (error) {
                  console.error('Erro de rede ou servidor ao atualizar aluno:', error);
                  showGlobalMessageModal('Erro de Conexão', 'Erro de conexão ou servidor. Tente novamente mais tarde.'); // MODIFICAÇÃO
              } finally {
            hideLoading(); // ADIÇÃO
          }
      }


      // --- Outras Funções ---
      // Funções de navegação e logout
      function goBack() {
          window.history.back();
      }

      // REMOÇÃO: goToPage não é usada no código atual, pode ser removida
      // function goToPage(page) {
      //     window.location.href = page;
      // }

      async function logout() { // MODIFICAÇÃO: Adicionado 'async'
          const userId = localStorage.getItem("userId"); // ADIÇÃO: Pega o ID do usuário logado
          if (userId) {
              showLoading(); // ADIÇÃO: Adiciona o spinner ao sair
              try {
                  await fetch(`http://127.0.0.1:5000/logout/${userId}`, { // ADIÇÃO: Chama o endpoint de logout
                      method: 'POST',
                  });
                  console.log('Status online atualizado para offline.');
              } catch (error) {
                  console.error('Erro ao atualizar status de logout:', error);
              } finally {
                hideLoading(); // ADIÇÃO
              }
          }
          localStorage.removeItem("isLoggedIn");
          localStorage.removeItem("userId"); // ADIÇÃO
          localStorage.removeItem("username");
          localStorage.removeItem("userRole");
          localStorage.removeItem("userName");
          localStorage.removeItem("userStudentId"); // ADIÇÃO
          window.location.href = "index.html";
      }

      const userAvatar = document.querySelector(".user-avatar")
      if (userAvatar) {
          console.log('Elemento .user-avatar encontrado:', userAvatar);
          userAvatar.addEventListener("click", () => {
              console.log('Clique no .user-avatar detectado.');
              showConfirmModal('Confirmar Logout', 'Você tem certeza que deseja fazer logout?', () => {
                  logout();
              });
          })
          userAvatar.style.cursor = "pointer"
          userAvatar.title = "Clique para fazer logout"
      } else {
          console.warn('Elemento .user-avatar NÃO ENCONTRADO.');
      }

      function abrirWhatsApp() {
          const whatsappLink = "https://chat.whatsapp.com/GHZuEpQhb5uGFROPWioy9o?mode=ac_c";
          window.open(whatsappLink, '_blank');
      }

      // Fechar modals ao clicar fora ou pressionar ESC
      // ADIÇÃO: Garantir que estas funções são acessíveis globalmente se forem chamadas via onclick
      window.closeAddAlunoModal = window.closeAddAlunoModal || function() { // Garante que a função está definida
          document.getElementById('addAlunoModal').classList.add('hidden');
          document.getElementById('addAlunoForm').reset();
      };

      window.closeEditAlunoModal = window.closeEditAlunoModal || function() { // Garante que a função está definida
          document.getElementById('editAlunoModal').classList.add('hidden');
          document.getElementById('editAlunoForm').reset();
      };

      document.addEventListener('keydown', (e) => {
          const addAlunoModal = document.getElementById('addAlunoModal');
          const editAlunoModal = document.getElementById('editAlunoModal');
          
          if (e.key === 'Escape') {
              if (addAlunoModal && !addAlunoModal.classList.contains('hidden')) {
                  closeAddAlunoModal();
              }
              if (editAlunoModal && !editAlunoModal.classList.contains('hidden')) {
                  closeEditAlunoModal();
              }
          }
      });
}); // Fim do DOMContentLoaded


// Funções globais para serem acessíveis diretamente do HTML (onclick)
window.changeTable = function() {
    const selectedTable = document.getElementById('tableSelect').value;
    document.querySelectorAll('.database-table-container').forEach(table => {
        table.classList.add('hidden');
    });
    document.getElementById(`table_${selectedTable}`).classList.remove('hidden');

    // ADIÇÃO: Chamadas de fetch para as novas tabelas, descomentadas e ajustadas
    if (selectedTable === 'info_alunos') {
        window.fetchAlunosFromBackend();
    } else if (selectedTable === 'status_alunos') {
        window.fetchStudentOverallStatusFromBackend();
    } else if (selectedTable === 'login_alunos') {
        window.fetchLoginAlunosFromBackend();
    } else if (selectedTable === 'atividades_alunos') {
        window.fetchAtividadesAlunosFromBackend();
    }
};

window.searchTable = function() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const activeTable = document.querySelector('.database-table-container:not(.hidden)');
    if (activeTable) {
        const rows = activeTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
};

window.editRecord = function() {
    const selectedTable = document.getElementById('tableSelect').value;
    if (selectedTable === 'info_alunos') {
        showGlobalMessageModal('Instrução', 'Clique nos botões "✏️" ao lado de cada aluno para editar.'); // MODIFICAÇÃO
    } else {
        showGlobalMessageModal('Atenção', `Funcionalidade de edição ainda não implementada para a tabela: ${selectedTable}`); // MODIFICAÇÃO
    }
};