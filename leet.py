def twoSum(numbers, target):
    """
    :type numbers: List[int]
    :type target: int
    :rtype: List[int]
    """
    left = 0
    right = left +1
    
    while right < len(numbers)-1:
        if numbers[left] + numbers[right] < target:
            left +=1  

        elif numbers[left] + numbers[right] > target:
            right += 1

        else:
            return [left +1, right +1]
        
        
        
print(twoSum([2,7,11,15], 9))