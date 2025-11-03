amount = float(input("Please enter your expected amount: "))
i = float(input("Please enter the yearly interest rate in percent: "))
n = int(input("Please enter the number of years: "))


def calculate(amount, i, n):
    res = amount / (1 + (i/100))**n
    
    return res

print(calculate(amount, i, n))