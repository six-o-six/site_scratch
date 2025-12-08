from flask import Flask, jsonify, send_from_directory, request, make_response
import mysql.connector
import os
import random
import string
import re
from commands import (
    CommandInvoker, StudentReceiver, UserReceiver, ClassReceiver, 
    AttendanceReceiver, MaterialReceiver, ActivityReceiver,
    AddStudentCommand, UpdateStudentCommand, DeleteStudentCommand,
    AddUserCommand, UpdateUserCommand, DeleteUserCommand,
    LoginCommand, LogoutCommand,
    AddClassCommand, UpdateClassCommand, DeleteClassCommand,
    BatchAttendanceCommand, DeleteAttendanceCommand,
    UploadMaterialCommand, UpdateMaterialCommand, DeleteMaterialCommand,
    UpdateActivityCommand
)

app = Flask(__name__, static_folder=os.path.abspath(os.path.join(os.path.dirname(__file__), '../PROJETO_FINAL')), static_url_path='/')

# Configurações DB
db_config = {
    'host': 'localhost',
    'database': 'Scratch',
    'user': 'root',
    'password': '1234' # SUA SENHA
}

UPLOAD_FOLDER = os.path.join(app.static_folder, 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- INICIALIZAÇÃO DO PADRÃO COMMAND ---
invoker = CommandInvoker()
# Receivers
student_recv = StudentReceiver(db_config)
user_recv = UserReceiver(db_config)
class_recv = ClassReceiver(db_config)
attendance_recv = AttendanceReceiver(db_config)
material_recv = MaterialReceiver(db_config)
activity_recv = ActivityReceiver(db_config)

# --- FUNÇÕES AUXILIARES (Validação e Utils) ---
def create_db_connection():
    return mysql.connector.connect(**db_config)

def authorize_teacher_access():
    # Simulação de Auth (Tática Authorize Actors)
    # Em produção, validar sessão/token
    if request.headers.get('X-Auth-Role') != 'teacher':
        # Para facilitar testes locais sem header, permitimos 'student' em rotas públicas
        # mas para rotas de escrita críticas assumimos 'teacher' padrão para este exemplo
        pass 
    return None

def validate_aluno_data(data):
    if 'nome' in data and len(data.get('nome', '')) > 70: return False, 'Nome muito longo'
    if 'cpf' in data and data['cpf'] and not re.fullmatch(r'\d{11}', data.get('cpf', '')): return False, 'CPF inválido'
    return True, ''

allowed_turmas = ['25.1 - T1', '25.1 - T2', '25.2 - T1']

def generate_username(full_name, connection):
    if not full_name: return None
    base = "".join([p[0].lower() for p in full_name.split() if p])
    username = base
    counter = 1
    cursor = connection.cursor()
    while True:
        cursor.execute("SELECT COUNT(*) FROM users WHERE username = %s", (username,))
        if cursor.fetchone()[0] == 0: break
        username = f"{base}{counter}"
        counter += 1
    cursor.close()
    return username

def generate_random_password(length=7):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for i in range(length))

# --- ROTAS PADRÃO (GET - LEITURA) ---
# Mantidas no padrão CQS (Consultas diretas)

@app.route('/')
def serve_index(): return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:filename>')
def serve_static_files(filename): return send_from_directory(app.static_folder, filename)

@app.route('/alunos', methods=['GET'])
def get_alunos():
    conn = create_db_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM alunos")
        res = cur.fetchall()
        for r in res: 
            if r['data_nascimento']: r['data_nascimento'] = r['data_nascimento'].strftime('%Y-%m-%d')
        return jsonify(res)
    finally: conn.close()

@app.route('/classes', methods=['GET'])
def get_classes():
    conn = create_db_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM classes ORDER BY date ASC")
        res = cur.fetchall()
        for r in res: 
            if r['date']: r['date'] = r['date'].isoformat()
        return jsonify(res)
    finally: conn.close()

@app.route('/users', methods=['GET'])
def get_users():
    conn = create_db_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id, username, full_name, role, student_id, last_login, total_logins, online_status FROM users")
        res = cur.fetchall()
        for r in res:
            if r['last_login']: r['last_login'] = r['last_login'].isoformat()
        return jsonify(res)
    finally: conn.close()

@app.route('/attendance', methods=['GET'])
def get_attendance():
    conn = create_db_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT ar.*, a.nome as student_name, c.title as class_title FROM attendance_records ar JOIN alunos a ON ar.student_id = a.id JOIN classes c ON ar.class_id = c.id")
        return jsonify(cur.fetchall())
    finally: conn.close()

@app.route('/materials', methods=['GET'])
def get_materials():
    conn = create_db_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM materials ORDER BY upload_date DESC")
        return jsonify(cur.fetchall())
    finally: conn.close()

@app.route('/materials/download/<path:filename>', methods=['GET'])
def download_material(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

@app.route('/config', methods=['GET'])
def get_config(): return jsonify({'numberOfActivities': 10})

@app.route('/status_alunos', methods=['GET'])
def get_status():
    conn = create_db_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT sa.*, a.nome as student_name FROM status_alunos sa JOIN alunos a ON sa.id = a.id")
        return jsonify(cur.fetchall())
    finally: conn.close()

@app.route('/atividades_alunos', methods=['GET'])
def get_activities():
    conn = create_db_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT aa.*, a.nome as student_name FROM atividades_alunos aa JOIN alunos a ON aa.id = a.id ORDER BY a.nome")
        return jsonify(cur.fetchall())
    finally: conn.close()

# --- ROTAS DE ESCRITA REFATORADAS (COMMAND PATTERN) ---

# 1. Alunos
@app.route('/alunos/add', methods=['POST'])
def add_aluno():
    data = request.get_json()
    if not data.get('nome') or not data.get('turma'): return jsonify({'success': False, 'message': 'Dados incompletos'}), 400
    
    valid, msg = validate_aluno_data(data)
    if not valid: return jsonify({'success': False, 'message': msg}), 400

    cmd = AddStudentCommand(student_recv, data, generate_username, generate_random_password)
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res), 201 if res['success'] else 500

@app.route('/alunos/edit/<int:id>', methods=['PUT'])
def edit_aluno(id):
    data = request.get_json()
    valid, msg = validate_aluno_data(data)
    if not valid: return jsonify({'success': False, 'message': msg}), 400
    
    cmd = UpdateStudentCommand(student_recv, id, data)
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res), 200 if res['success'] else 500

@app.route('/alunos/delete/<int:id>', methods=['DELETE'])
def delete_aluno(id):
    cmd = DeleteStudentCommand(student_recv, id)
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res), 200 if res['success'] else 500

# 2. Users
@app.route('/users/add', methods=['POST'])
def add_user():
    data = request.get_json()
    cmd = AddUserCommand(user_recv, data)
    res = invoker.execute_command(cmd, user_initiator="Admin")
    return jsonify(res), 201 if res['success'] else 500

@app.route('/users/edit/<int:id>', methods=['PUT'])
def edit_user(id):
    data = request.get_json()
    cmd = UpdateUserCommand(user_recv, id, data)
    res = invoker.execute_command(cmd, user_initiator="Admin")
    return jsonify(res)

@app.route('/users/delete/<int:id>', methods=['DELETE'])
def delete_user(id):
    cmd = DeleteUserCommand(user_recv, id)
    res = invoker.execute_command(cmd, user_initiator="Admin")
    return jsonify(res)

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    cmd = LoginCommand(user_recv, data.get('username'), data.get('password'))
    res = invoker.execute_command(cmd, user_initiator="Anonimo") # Login é público
    return jsonify(res), 200 if res['success'] else 401

@app.route('/logout/<int:id>', methods=['POST'])
def logout(id):
    cmd = LogoutCommand(user_recv, id)
    res = invoker.execute_command(cmd, user_initiator=f"User_{id}")
    return jsonify(res)

# 3. Classes
@app.route('/classes/add', methods=['POST'])
def add_class():
    data = request.get_json()
    cmd = AddClassCommand(class_recv, data)
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res), 201 if res['success'] else 500

@app.route('/classes/edit/<int:id>', methods=['PUT'])
def edit_class(id):
    data = request.get_json()
    cmd = UpdateClassCommand(class_recv, id, data)
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res)

@app.route('/classes/delete/<int:id>', methods=['DELETE'])
def delete_class(id):
    cmd = DeleteClassCommand(class_recv, id)
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res)

# 4. Attendance
@app.route('/attendance/batch-update', methods=['POST'])
def batch_attendance():
    records = request.get_json()
    cmd = BatchAttendanceCommand(attendance_recv, records)
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res), 200 if res['success'] else 500

@app.route('/attendance/delete/<int:id>', methods=['DELETE'])
def delete_attendance(id):
    cmd = DeleteAttendanceCommand(attendance_recv, id)
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res)

# 5. Materials
@app.route('/materials/upload', methods=['POST'])
def upload_material():
    if 'file' not in request.files: return jsonify({'success': False}), 400
    file = request.files['file']
    name = request.form.get('name', file.filename)
    desc = request.form.get('description', '')
    
    cmd = UploadMaterialCommand(material_recv, name, desc, file, app.config['UPLOAD_FOLDER'])
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res), 201 if res['success'] else 500

@app.route('/materials/edit/<int:id>', methods=['PUT'])
def edit_material(id):
    data = request.get_json()
    cmd = UpdateMaterialCommand(material_recv, id, data)
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res)

@app.route('/materials/delete/<int:id>', methods=['DELETE'])
def delete_material(id):
    cmd = DeleteMaterialCommand(material_recv, id, app.config['UPLOAD_FOLDER'])
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res)

# 6. Activities
@app.route('/atividades_alunos/update_aula/<int:id>', methods=['PUT'])
def update_activity(id):
    data = request.get_json()
    cmd = UpdateActivityCommand(activity_recv, id, data.get('aula_col'), data.get('new_status'))
    res = invoker.execute_command(cmd, user_initiator="Professor")
    return jsonify(res)

if __name__ == '__main__':
    app.run(debug=True, port=5000)