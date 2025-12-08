import mysql.connector
from mysql.connector import Error
from werkzeug.security import generate_password_hash, check_password_hash
from abc import ABC, abstractmethod
import datetime
import os

# --- PADRÃO OBSERVER (Mantido para Presença) ---
class Observer:
    def update(self, subject, student_id):
        raise NotImplementedError

class Subject:
    def __init__(self):
        self._observers = []
    def attach(self, observer):
        if observer not in self._observers:
            self._observers.append(observer)
    def notify(self, student_id):
        for observer in self._observers:
            observer.update(self, student_id)

class StudentStatusObserver(Observer):
    def __init__(self, db_config):
        self.db_config = db_config

    def update(self, subject, student_id):
        print(f"[OBSERVER] Atualizando status do aluno ID: {student_id}")
        try:
            conn = mysql.connector.connect(**self.db_config)
            cursor = conn.cursor()
            
            # Recalcular faltas
            cursor.execute("SELECT COUNT(*) FROM attendance_records WHERE student_id = %s AND attendance_status IN ('F', 'Fj')", (student_id,))
            total_absences = cursor.fetchone()[0]
            
            # Definir situação
            situacao = 'Desistente' if total_absences >= 3 else 'Ativo'
            
            # Atualizar tabela
            sql = "INSERT INTO status_alunos (id, faltas, situacao) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE faltas = VALUES(faltas), situacao = VALUES(situacao)"
            cursor.execute(sql, (student_id, total_absences, situacao))
            conn.commit()
        except Error as e:
            print(f"[OBSERVER ERROR] {e}")
        finally:
            if conn and conn.is_connected(): conn.close()

# --- PADRÃO COMMAND ---

# 1. Interface Command
class Command(ABC):
    @abstractmethod
    def execute(self):
        pass

# 2. Invoker (Gerencia execução e Logs)
class CommandInvoker:
    def __init__(self):
        self.history = []

    def execute_command(self, command, user_initiator="Sistema"):
        # LOG DE AUDITORIA CENTRALIZADO
        print(f"[AUDIT LOG] {datetime.datetime.now()} - Usuário '{user_initiator}' executou: {command.__class__.__name__}")
        
        result = command.execute()
        
        if result.get('success'):
            self.history.append(command)
        
        return result

# 3. Base Receiver (Classe Pai para conexão com BD)
class BaseReceiver:
    def __init__(self, db_config):
        self.db_config = db_config

    def get_connection(self):
        return mysql.connector.connect(**self.db_config)

# --- RECEIVERS ESPECÍFICOS (Lógica de Negócio) ---

class StudentReceiver(BaseReceiver):
    def create_student(self, data, gen_user, gen_pass):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            conn.start_transaction()
            
            # Insert Aluno
            sql_aluno = """INSERT INTO alunos (turma, nome, email, telefone, data_nascimento, rg, cpf, endereco, escolaridade, escola, responsavel) 
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
            vals_aluno = (data['turma'], data['nome'], data.get('email'), data.get('telefone'), data.get('data_nascimento'), 
                          data.get('rg'), data['cpf'], data.get('endereco'), data['escolaridade'], data['escola'], data['responsavel'])
            cursor.execute(sql_aluno, vals_aluno)
            student_id = cursor.lastrowid

            # Insert User
            hashed = generate_password_hash(gen_pass)
            cursor.execute("INSERT INTO users (username, password_hash, full_name, role, student_id) VALUES (%s, %s, %s, 'student', %s)",
                           (gen_user, hashed, data['nome'], student_id))

            # Inicializa tabelas dependentes
            cursor.execute("INSERT INTO status_alunos (id, faltas, situacao) VALUES (%s, 0, 'Ativo')", (student_id,))
            cursor.execute("INSERT INTO atividades_alunos (id) VALUES (%s)", (student_id,))

            conn.commit()
            return {'success': True, 'message': 'Aluno criado com sucesso!', 'generated_username': gen_user, 'generated_password': gen_pass}
        except Error as e:
            conn.rollback()
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

    def update_student(self, student_id, data):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            fields = []
            values = []
            for k, v in data.items():
                if k != 'id': # Proteção simples
                    fields.append(f"{k} = %s")
                    values.append(v)
            
            if not fields: return {'success': False, 'message': 'Sem dados para atualizar'}
            
            values.append(student_id)
            sql = f"UPDATE alunos SET {', '.join(fields)} WHERE id = %s"
            cursor.execute(sql, tuple(values))
            
            # Sincronizar nome no usuário se mudou
            if 'nome' in data:
                cursor.execute("UPDATE users SET full_name = %s WHERE student_id = %s", (data['nome'], student_id))
            
            conn.commit()
            return {'success': True, 'message': 'Aluno atualizado.'} if cursor.rowcount > 0 else {'success': False, 'message': 'Aluno não encontrado.'}
        except Error as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

    def delete_student(self, student_id):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM alunos WHERE id = %s", (student_id,))
            conn.commit()
            return {'success': True, 'message': 'Aluno excluído.'} if cursor.rowcount > 0 else {'success': False, 'message': 'Aluno não encontrado.'}
        except Error as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

class UserReceiver(BaseReceiver):
    def create_user(self, username, password, role, full_name, student_id):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            hashed = generate_password_hash(password)
            sql = "INSERT INTO users (username, password_hash, full_name, role, student_id) VALUES (%s, %s, %s, %s, %s)"
            cursor.execute(sql, (username, hashed, full_name, role, student_id))
            conn.commit()
            return {'success': True, 'message': 'Usuário criado.'}
        except Error as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

    def update_user(self, user_id, data):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            fields = []
            vals = []
            for k, v in data.items():
                if k == 'password' and v:
                    fields.append("password_hash = %s")
                    vals.append(generate_password_hash(v))
                elif k != 'password':
                    fields.append(f"{k} = %s")
                    vals.append(v)
            
            vals.append(user_id)
            sql = f"UPDATE users SET {', '.join(fields)} WHERE id = %s"
            cursor.execute(sql, tuple(vals))
            conn.commit()
            return {'success': True, 'message': 'Usuário atualizado.'}
        except Error as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

    def delete_user(self, user_id):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
            conn.commit()
            return {'success': True, 'message': 'Usuário excluído.'}
        except Error as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

    def login(self, username, password):
        conn = self.get_connection()
        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            
            if user and user.get('failed_login_attempts', 0) >= 5:
                return {'success': False, 'message': 'Conta bloqueada.', 'code': 401}

            if user and check_password_hash(user['password_hash'], password):
                cursor.execute("UPDATE users SET last_login = NOW(), total_logins = total_logins + 1, online_status = 'Online', failed_login_attempts = 0 WHERE id = %s", (user['id'],))
                conn.commit()
                return {'success': True, 'user': user}
            else:
                if user:
                    cursor.execute("UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = %s", (user['id'],))
                    conn.commit()
                return {'success': False, 'message': 'Credenciais inválidas.', 'code': 401}
        finally:
            conn.close()

    def logout(self, user_id):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET online_status = 'Offline' WHERE id = %s", (user_id,))
            conn.commit()
            return {'success': True}
        finally:
            conn.close()

class ClassReceiver(BaseReceiver):
    def create_class(self, data):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            sql = "INSERT INTO classes (title, date, status, description) VALUES (%s, %s, %s, %s)"
            cursor.execute(sql, (data['title'], data['date'], data.get('status', 'future'), data.get('description')))
            conn.commit()
            return {'success': True, 'message': 'Aula criada.'}
        except Error as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

    def update_class(self, class_id, data):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            fields = [f"{k} = %s" for k in data.keys()]
            vals = list(data.values()) + [class_id]
            sql = f"UPDATE classes SET {', '.join(fields)} WHERE id = %s"
            cursor.execute(sql, tuple(vals))
            conn.commit()
            return {'success': True, 'message': 'Aula atualizada.'}
        except Error as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

    def delete_class(self, class_id):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM classes WHERE id = %s", (class_id,))
            conn.commit()
            return {'success': True, 'message': 'Aula excluída.'}
        except Error as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

class AttendanceReceiver(BaseReceiver):
    def __init__(self, db_config):
        super().__init__(db_config)
        self.subject = Subject()
        self.subject.attach(StudentStatusObserver(db_config))

    def batch_update(self, records):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            conn.start_transaction()
            student_ids = set()
            
            sql = "INSERT INTO attendance_records (student_id, class_id, attendance_status) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE attendance_status = VALUES(attendance_status)"
            
            for rec in records:
                cursor.execute(sql, (rec['student_id'], rec['class_id'], rec['attendance_status']))
                student_ids.add(rec['student_id'])
            
            conn.commit()
            
            # Notificar Observer para cada aluno afetado
            for sid in student_ids:
                self.subject.notify(sid)
                
            return {'success': True, 'message': 'Presença em lote salva.'}
        except Error as e:
            conn.rollback()
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

    def add_record(self, data):
        # Wrapper para usar a lógica de batch para um único registro
        return self.batch_update([data])

    def delete_record(self, record_id):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            # Pegar ID do aluno antes de deletar para notificar observer
            cursor.execute("SELECT student_id FROM attendance_records WHERE id = %s", (record_id,))
            res = cursor.fetchone()
            if not res: return {'success': False, 'message': 'Registro não encontrado.'}
            
            sid = res[0]
            cursor.execute("DELETE FROM attendance_records WHERE id = %s", (record_id,))
            conn.commit()
            
            self.subject.notify(sid)
            return {'success': True, 'message': 'Registro excluído.'}
        except Error as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

class MaterialReceiver(BaseReceiver):
    def create_material(self, name, desc, file_obj, upload_folder):
        conn = self.get_connection()
        try:
            filename = file_obj.filename
            path = os.path.join(upload_folder, filename)
            file_obj.save(path)
            
            cursor = conn.cursor()
            sql = "INSERT INTO materials (name, file_type, file_size, description, file_path) VALUES (%s, %s, %s, %s, %s)"
            cursor.execute(sql, (name, file_obj.content_type, file_obj.content_length, desc, filename))
            conn.commit()
            return {'success': True, 'message': 'Material enviado.', 'id': cursor.lastrowid}
        except Exception as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

    def update_material(self, mat_id, data):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            fields = [f"{k} = %s" for k in data.keys()]
            vals = list(data.values()) + [mat_id]
            cursor.execute(f"UPDATE materials SET {', '.join(fields)} WHERE id = %s", tuple(vals))
            conn.commit()
            return {'success': True, 'message': 'Material atualizado.'}
        except Error as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

    def delete_material(self, mat_id, upload_folder):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT file_path FROM materials WHERE id = %s", (mat_id,))
            res = cursor.fetchone()
            if res:
                path = os.path.join(upload_folder, res[0])
                if os.path.exists(path): os.remove(path)
            
            cursor.execute("DELETE FROM materials WHERE id = %s", (mat_id,))
            conn.commit()
            return {'success': True, 'message': 'Material excluído.'}
        except Exception as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

class ActivityReceiver(BaseReceiver):
    def update_status(self, aluno_id, aula_col, new_status):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            # Update status
            cursor.execute(f"UPDATE atividades_alunos SET {aula_col} = %s WHERE id = %s", (new_status, aluno_id))
            
            # Recalcular total
            sum_parts = [f"CASE WHEN aula_{i} IN ('Enviada', 'Verificada') THEN 1 ELSE 0 END" for i in range(1, 11)]
            sql_sum = f"UPDATE atividades_alunos SET total_enviadas = ({' + '.join(sum_parts)}) WHERE id = %s"
            cursor.execute(sql_sum, (aluno_id,))
            
            conn.commit()
            return {'success': True, 'message': 'Atividade atualizada.'}
        except Error as e:
            return {'success': False, 'message': str(e)}
        finally:
            conn.close()

# --- CONCRETE COMMANDS (Mapeiam rotas para receivers) ---

class AddStudentCommand(Command):
    def __init__(self, receiver, data, user_gen_fn, pass_gen_fn):
        self.receiver = receiver
        self.data = data
        self.user_gen = user_gen_fn
        self.pass_gen = pass_gen_fn
    def execute(self):
        # Gera credenciais temporariamente (idealmente deveria ser no receiver ou serviço, mas ok aqui)
        temp_conn = self.receiver.get_connection()
        gen_user = self.user_gen(self.data['nome'], temp_conn)
        temp_conn.close()
        gen_pass = self.pass_gen()
        return self.receiver.create_student(self.data, gen_user, gen_pass)

class UpdateStudentCommand(Command):
    def __init__(self, receiver, sid, data):
        self.receiver = receiver
        self.sid = sid
        self.data = data
    def execute(self): return self.receiver.update_student(self.sid, self.data)

class DeleteStudentCommand(Command):
    def __init__(self, receiver, sid):
        self.receiver = receiver
        self.sid = sid
    def execute(self): return self.receiver.delete_student(self.sid)

class AddUserCommand(Command):
    def __init__(self, receiver, data):
        self.receiver = receiver
        self.data = data
    def execute(self): return self.receiver.create_user(self.data['username'], self.data['password'], self.data['role'], self.data.get('full_name'), self.data.get('student_id'))

class UpdateUserCommand(Command):
    def __init__(self, receiver, uid, data):
        self.receiver = receiver
        self.uid = uid
        self.data = data
    def execute(self): return self.receiver.update_user(self.uid, self.data)

class DeleteUserCommand(Command):
    def __init__(self, receiver, uid):
        self.receiver = receiver
        self.uid = uid
    def execute(self): return self.receiver.delete_user(self.uid)

class LoginCommand(Command):
    def __init__(self, receiver, username, password):
        self.receiver = receiver
        self.u = username
        self.p = password
    def execute(self): return self.receiver.login(self.u, self.p)

class LogoutCommand(Command):
    def __init__(self, receiver, uid):
        self.receiver = receiver
        self.uid = uid
    def execute(self): return self.receiver.logout(self.uid)

class AddClassCommand(Command):
    def __init__(self, receiver, data):
        self.receiver = receiver
        self.data = data
    def execute(self): return self.receiver.create_class(self.data)

class UpdateClassCommand(Command):
    def __init__(self, receiver, cid, data):
        self.receiver = receiver
        self.cid = cid
        self.data = data
    def execute(self): return self.receiver.update_class(self.cid, self.data)

class DeleteClassCommand(Command):
    def __init__(self, receiver, cid):
        self.receiver = receiver
        self.cid = cid
    def execute(self): return self.receiver.delete_class(self.cid)

class BatchAttendanceCommand(Command):
    def __init__(self, receiver, records):
        self.receiver = receiver
        self.records = records
    def execute(self): return self.receiver.batch_update(self.records)

class DeleteAttendanceCommand(Command):
    def __init__(self, receiver, rid):
        self.receiver = receiver
        self.rid = rid
    def execute(self): return self.receiver.delete_record(self.rid)

class UploadMaterialCommand(Command):
    def __init__(self, receiver, name, desc, file, folder):
        self.receiver = receiver
        self.name = name
        self.desc = desc
        self.file = file
        self.folder = folder
    def execute(self): return self.receiver.create_material(self.name, self.desc, self.file, self.folder)

class UpdateMaterialCommand(Command):
    def __init__(self, receiver, mid, data):
        self.receiver = receiver
        self.mid = mid
        self.data = data
    def execute(self): return self.receiver.update_material(self.mid, self.data)

class DeleteMaterialCommand(Command):
    def __init__(self, receiver, mid, folder):
        self.receiver = receiver
        self.mid = mid
        self.folder = folder
    def execute(self): return self.receiver.delete_material(self.mid, self.folder)

class UpdateActivityCommand(Command):
    def __init__(self, receiver, sid, col, status):
        self.receiver = receiver
        self.sid = sid
        self.col = col
        self.status = status
    def execute(self): return self.receiver.update_status(self.sid, self.col, self.status)