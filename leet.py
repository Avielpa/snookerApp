#Calculate the distance between 2 lists of numbers.
def euclidean_distance(num_list1, num_list2):
    lists_len = len(num_list1) - 1 #It dosnt metter which list, we alredy checked the lists are with the same length
    dis = 0 
    while lists_len > 0:
        dis += (float(num_list1[0]) - float(num_list2[0]))**2
        num_list1 = num_list1[1:]#cut the first plcae in the list
        num_list2 = num_list2[1:]
        lists_len = len(num_list1)
        
    return round(dis**0.5,2)

#verify user in put is numeric
def is_number(usr_input):
    
    for dig in usr_input:
        
        if dig == "+" or dig == "-":
            continue
        
        elif "." in dig:
            dig = dig.replace(".","")
            
        elif dig.isdigit():
            continue
        
        else:
            return False
    return True
        
        

#Fix user input
def user_input_rep(string_rep):
    string_rep = string_rep.replace(" ", "")
    string_rep = string_rep.split(",")
    return string_rep



def main_program():
    
    dis = 0
    
    #assume that the user input is something like that "1 , 2 , 3 , 4 , 7"
    usr_in1 = input("Enter list1 (coordinates of point X): ")
    usr_in2 = input("Enter list2 (coordinates of point Y): ")
    
    usr_in1 = user_input_rep(usr_in1)
    usr_in2 = user_input_rep(usr_in2)
    
    #verify the length is equal
    if len(usr_in1) == len(usr_in2):
        #check both inputs are numeric
        if is_number(usr_in1) and is_number(usr_in2):
            #calc the distance
            dis = euclidean_distance(usr_in1,usr_in2)
            return f"The Euclidean distance between the points is: {dis}"
        else:
            return "Sorry - was not able to calculate the distance"
    else:
        return "Sorry - was not able to calculate the distance"
    
    
print(main_program())