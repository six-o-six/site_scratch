from werkzeug.security import generate_password_hash

passwords_to_hash = {
    "python2024": "programacao",
    "scratch123": "professor",
}

hashed_passwords = {}

print("--- Senhas Hashed Geradas ---")
for clear_password, username in passwords_to_hash.items():
    hashed_pwd = generate_password_hash(clear_password)
    hashed_passwords[username] = hashed_pwd
    print(f"Usuário: '{username}' | Senha Original: '{clear_password}' -> Hashed: '{hashed_pwd}'")

print("\nCopie os valores Hashed acima e cole-os nas instruções INSERT SQL abaixo.")