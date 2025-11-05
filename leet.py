password = input("choose a password: ")
pass_length = True
contain_dig = True
forbidde_seq = True
start_lower = True
end_upper = True
necc_char = True
dig0 = "0" 
dig1 = "1" 
dig2 = "2" 
dig3 = "3" 
dig4 = "4" 
dig5 = "5" 
dig6 = "6" 
dig7 = "7" 
dig8 = "8" 
dig9 = "9" 
sec_req = False
 


if len(password) < 8 or len(password) > 10:
    pass_length = False
    
if (dig0 not in password and 
    dig1 not in password and
    dig2 not in password and
    dig3 not in password and
    dig4 not in password and
    dig5 not in password and
    dig6 not in password and
    dig7 not in password and
    dig8 not in password and
    dig9 not in password):
    
    contain_dig = False
        
        
if  "123" in password or "321" in password or "abc" in password or "qwe" in password:
    forbidde_seq = False
    
if password[0].islower():
    start_lower = False
    
if password[len(password) - 1].isupper():
    print(len(password)-1)
    end_upper = False
    
    
if  "#" not in password and "+" not in password and "!" not in password and "&" not in password and "@" not in password:
    necc_char = False
    
print("Your password is of proper length (8-10): ", pass_length)
print("Your password contains a digit: ", contain_dig)
print("Your password doesn’t contain trivial sequences: ", forbidde_seq)
print("Your password starts with an uppercase letter: ", start_lower)
print("Your password ends with a lowercase letter: ", end_upper)
print("Your password contains a special character: ", necc_char)


if pass_length and contain_dig and forbidde_seq and start_lower and end_upper  and necc_char :
    sec_req = True
    

print("Your password meets security requirements: ", sec_req)