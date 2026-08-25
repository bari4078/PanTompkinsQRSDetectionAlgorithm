# Python Syntax & Patterns for Novices

If you are new to Python or Object-Oriented Programming (OOP), the code in this project might look a bit intimidating. This document breaks down the key concepts used.

## 1. Classes and Objects (OOP)

In Python, a **Class** is like a blueprint for a house. An **Object** is the actual house built from that blueprint.

```python
class DataLoader:
    def __init__(self, data_dir='mitbih_data'):
        self.data_dir = data_dir
        
    def get_available_records(self):
        return ['100', '101']
```
* **`class DataLoader:`**: This defines the blueprint.
* **`def __init__(self, ...):`**: This is a special method called a **constructor**. It runs automatically when you create a new object. It's used to set up initial settings.
* **`self`**: This is a reference to the specific object being created. It allows the object to store its own variables (like `self.data_dir`).
* **`def get_available_records(self):`**: This is a **method**—a function that belongs to the class.

**How to use it:**
```python
loader = DataLoader() # Builds the "house"
records = loader.get_available_records() # Uses a feature of the house
```

## 2. The Strategy Design Pattern

A "Design Pattern" is a proven solution to a common software problem. 

In our code, we use the **Strategy Pattern** for the filters. Imagine a coffee machine that can make Espresso, Latte, or Cappuccino. Instead of one massive machine with confusing internal wiring, you have interchangeable "pods" (strategies). 

```python
class FilterStrategy:
    def apply(self, signal, fs):
        raise NotImplementedError("Must implement!")

class BandpassFilter(FilterStrategy):
    def apply(self, signal, fs):
        # ... specific bandpass logic ...

class SquaringFilter(FilterStrategy):
    def apply(self, signal, fs):
        # ... specific squaring logic ...
```
* `FilterStrategy` is the base template. It says, "Every filter must have an `apply` method."
* `BandpassFilter` and `SquaringFilter` are the specific "pods". They inherit from the template (indicated by `(FilterStrategy)`) but implement their own unique logic inside `apply`.

This makes the code easy to read and easy to expand. If you invent a new filter tomorrow, you just write a new class; you don't break the existing code!

## 3. The Facade Design Pattern

The **Facade Pattern** is like the steering wheel of a car. Under the hood, a car is incredibly complex (engine, transmission, fuel injection). But as a driver, you just use the steering wheel and pedals (the Facade) to control it all.

In our code, `PanTompkinsDetector` is the Facade.

```python
class PanTompkinsDetector:
    def __init__(self):
        self.bandpass = BandpassFilter()
        self.squaring = SquaringFilter()
        # ...

    def process(self, signal, fs):
        sig1 = self.bandpass.apply(signal, fs)
        sig2 = self.squaring.apply(sig1, fs)
        return sig2
```
Instead of forcing the user to manually run 5 different filters in exactly the right order, the `PanTompkinsDetector` handles all the complexity internally. The user just calls `detector.process()`.

## 4. NumPy Arrays

You'll see a lot of `np.array` in the code. NumPy is a Python library for doing math incredibly fast.

Standard Python lists are slow for math:
```python
my_list = [1, 2, 3]
# To multiply by 2, you have to write a loop.
```

NumPy arrays are fast and easy:
```python
import numpy as np
my_array = np.array([1, 2, 3])
result = my_array * 2 # Outputs [2, 4, 6] instantly!
```
When we process ECG signals with thousands of data points, NumPy is absolutely essential.
