import numpy as np
import matplotlib.pyplot as plt
import numpy_financial as npf

# נתוני הפרויקטים
# פרויקט א: השקעה 51,000, תזרים 18,000 למשך 5 שנים
cf_a = [-51000] + [18000] * 5

# פרויקט ב: השקעה 30,000, תזרים 11,500 למשך 5 שנים
cf_b = [-30000] + [11500] * 5

# טווח ריביות לגרף (0% עד 30%)
rates = np.linspace(0, 0.30, 100)

# חישוב הענ"נ לכל ריבית
npv_a = [npf.npv(r, cf_a) for r in rates]
npv_b = [npf.npv(r, cf_b) for r in rates]

# מציאת נקודת החיתוך (בקירוב)
# אנו יודעים שהיא באזור 16.6% מהחישוב הקודם
crossover_rate = 0.1658
crossover_npv = npf.npv(crossover_rate, cf_a)

# שרטוט הגרף
plt.figure(figsize=(10, 6))
plt.plot(rates * 100, npv_a, label='Project A', color='blue', linewidth=2)
plt.plot(rates * 100, npv_b, label='Project B', color='orange', linewidth=2)

# הוספת קו האפס
plt.axhline(0, color='black', linewidth=0.8, linestyle='--')

# סימון נקודת החיתוך
plt.plot(crossover_rate * 100, crossover_npv, 'ro', label=f'Crossover: {crossover_rate:.1%}')

# עיצוב הגרף
plt.title('NPV Profile: Project A vs Project B')
plt.xlabel('Discount Rate (%)')
plt.ylabel('Net Present Value (NPV)')
plt.legend()
plt.grid(True, alpha=0.3)

# הצגת הגרף
plt.show()