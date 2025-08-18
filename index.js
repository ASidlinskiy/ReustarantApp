import { menuArray } from "./data";

const menuItemElement = document.querySelector('.wrapper .menu');
const menuSelectedElement = document.querySelector('.menu-item-selected');
const cartPriceArray = []

const displayMenuHTML = function() { 
    menuArray.forEach(menu => {
        let  {emoji, name, ingredients, price, id} = menu          
        const menuItem = document.getElementById("menuItemTemplate").content.cloneNode(true).children[0];          
        const emojiElement = menuItem.querySelector('.menu-item .menu-item-emoji')
        const dataMenuIdElementAttr = menuItem.querySelector('.menu-item-buttons button')
        const menuItemButtonAdd = menuItem.querySelector('.menu-item-buttons button')
        const menuItemNameElement = menuItem.querySelector('.menu-item-description-heading')
        const menuItemIngredientsElement = menuItem.querySelector( '.menu-item-description-ingredients')
        const menuItemPriceElement = menuItem.querySelector( '.menu-item-description .menu-item-description-price')
        if(emojiElement) emojiElement.textContent = emoji
        if(menuItemNameElement) menuItemNameElement.textContent = name
        if(dataMenuIdElementAttr) dataMenuIdElementAttr.dataset.menuId = `${id}`
        if(menuItemButtonAdd) menuItemButtonAdd.setAttribute('aria-label', `Add ${name} to cart`)
        if(menuItemIngredientsElement) menuItemIngredientsElement.textContent = ingredients
        if(menuItemPriceElement) menuItemPriceElement.textContent = `$${price}`
        if(menuItemElement && menuItem){
            menuItemElement.append(menuItem)
        }else{
            console.error(`targetHtmlElement or menuItem is null`)
        }
    })
}
displayMenuHTML();
const cartItems = [];

let totalPrice = 0
const resetTotalPrice = function(){
    return totalPrice = 0
}
const addTotalPrice = function(price = 0,previousPrice = 0){
    return price + previousPrice
}
const toggleActiveClass = function(e){
    e.target.classList.toggle('active')
 }
const buildCartSelection = function(e) {
    const clickedId = e.target.dataset.menuId
    let subMenuItemForm = document.getElementById("menuItemTemplate").content.cloneNode(true).children[1];
    
    let repeatedLiElm;
  
    const selectedItem = menuArray.find(menu => menu.id === clickedId)

    if(selectedItem)
    {
        let  {emoji, name, ingredients, price, id} = selectedItem          
        if(document.getElementsByTagName('form')[0]){
            subMenuItemForm = document.getElementsByTagName('form')[0]
            repeatedLiElm = subMenuItemForm.querySelector('.row').cloneNode(true)        
 
            const titleElm = subMenuItemForm.querySelector('.menu-item-form-cart-name')   
            const cartItemRemoveBtnElm = subMenuItemForm.querySelector('.menu-item-form-cart-btn')
            const cartItemPriceElm = subMenuItemForm.querySelector('.menu-item-form-cart-price')
            const emojiElm = subMenuItemForm.querySelector('.menu-item-form-cart-emoji')
            const totalPriceElm = subMenuItemForm.querySelector('.menu-item-selected-order-totall')                
           
            if(emojiElm) emojiElm.textContent = emoji
            if(titleElm) titleElm.textContent = name
            if(cartItemRemoveBtnElm) cartItemRemoveBtnElm.setAttribute('aria-label', `Remove ${name} from cart`)
            if(cartItemRemoveBtnElm) cartItemRemoveBtnElm.dataset.menuId = id
            if(cartItemPriceElm) cartItemPriceElm.textContent = `$${price}`  
            if(totalPriceElm) totalPriceElm.textContent = `$${addTotalPrice(price)}`   

            subMenuItemForm.querySelector('.menu-item-form-cart').append(repeatedLiElm)
          
        }
        cartPriceArray.push(price)
        totalPrice = cartPriceArray.reduce((total, currentPrice) => total + currentPrice, 0) 
    }    

        if(subMenuItemForm && !document.getElementsByTagName('form')[0]){
            menuSelectedElement.append(subMenuItemForm)
            console.log("form append script ran")
        }

       
 }

displayMenuHTML();


menuItemElement.addEventListener('click', (e) => {
    if (e.target.classList.contains('menu-item-button-add')) {
        const button = e.target;
        const menuIdValue = button.dataset.menuId;

        if (!button.classList.contains('active')) {
            toggleActiveClass(e)
            // cartItems.push(menuIdValue)
            buildCartSelection(e)
            
            // console.log(`${menuIdValue}`);
                 
        } else {
            button.classList.remove('active');
            // const index = cartItems.indexOf(menuIdValue);
            // if (index > -1) cartItems.splice(index, 1);
            // console.log(`${menuIdValue} was UNclicked`);
        }

        if (cartItems.length > 0) {
            menuSelectedElement.style.display = "flex";
            const heightDivDiscrepancy = menuSelectedElement.clientHeight;
            document.querySelector("div[class='menu-item']:last-child").style.marginBottom = heightDivDiscrepancy + "px";
        } else {
            menuSelectedElement.style.display = "none";
            document.querySelector("div[class='menu-item']:last-child").style.marginBottom = "0";
        }
    }
});
// Fix the renderCartHtml() function - it should actually render items to the DOM
// Remove the unused global variables at the top
// Fix the typo in menuSelectedElelment
// Implement proper cart functionality - currently items are tracked but not displayed
// Clean up commented code and unused template parts
// Consider separating concerns - cart logic should be separate from menu display
