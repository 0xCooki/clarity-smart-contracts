;; Copyright: (c) 2023 by Nassau Machines Inc.
;; This file is part of Trust Machines.
;; Your Project is free software. You may redistribute or modify
;; it under the terms of the GNU General Public License as published by
;; the Free Software Foundation, either version 3 of the License or
;; (at your option) any later version.
;;
;; Your Project is distributed in the hope that it will be useful,
;; but WITHOUT ANY WARRANTY, including without the implied warranty of
;; MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
;; GNU General Public License for more details.
;;
;; You should have received a copy of the GNU General Public License
;; along with Your Project. If not, see <http://www.gnu.org/licenses/>.
;;
;; Based on Fungible Token, by @friedger
;; https://github.com/friedger/clarity-smart-contracts/blob/main/contracts/tokens/fungible-token.clar

;; Composable Fungible Token
(define-fungible-token fungible-token)

;; Storage ;;

;; Allowances
(define-map allowances {spender: principal, owner: principal} uint)

;; Total Supply
(define-data-var total-supply uint u0)

;; Decimals
(define-data-var decimals int 18)

;; Name
(define-data-var name (string-ascii 32) "MyToken")

;; Symbol
(define-data-var symbol (string-ascii 32) "MTK")

;; Retrieve an example URI that represents metadata of this token
(define-data-var token-uri (string-ascii 64) "ipfs://QmXwNHQ1BmE2hLRykAMMxjsmdeDGFSFg63KDMBUhtcMcKc")

;; Internals ;;

;; Gets the amount of tokens that an owner allowed to a spender.
(define-private (allowance (spender principal) (owner principal))
  (let ((allowance-val (default-to u0 (map-get? allowances { spender: spender, owner: owner }))))
    allowance-val))

;; Transfers tokens to a specified principal.
(define-private (transfer (amount uint) (sender principal) (recipient principal) )
  (match (ft-transfer? fungible-token amount sender recipient)
    result (ok true)
    error (err false)))

;; Decrease allowance of a specified spender.
(define-private (decrease-allowance (amount uint) (spender principal) (owner principal))
  (let ((allowance-val (allowance spender owner)))
    (if (or (> amount allowance-val) (<= amount u0)) true
      (begin
        (map-set allowances { spender: spender, owner: owner } (- allowance-val amount))
        true))))
        
;; Increase allowance of a specified spender.
(define-private (increase-allowance (amount uint) (spender principal) (owner principal))
  (let ((allowance-val (allowance spender owner)))
    (if (<= amount u0) false
      (begin
        (map-set allowances { spender: spender, owner: owner } (+ allowance-val amount))
        true))))

;; Mint new tokens.
(define-private (mint (amount uint) (account principal))
  (if (<= amount u0) (err false)
      (begin
        (var-set total-supply (+ (var-get total-supply) amount))
        (unwrap! (ft-mint? fungible-token amount account) (err false))
        (ok amount))))

;; Public functions ;;

;; Transfers tokens to a specified principal.
;; #[allow(unchecked_data)]
(define-public (transfer-token (amount uint) (recipient principal))
  (begin 
    (asserts! (> amount u0) (err false))
    (transfer amount tx-sender recipient)))

;; Transfers tokens to a specified principal, performed by a spender
;; #[allow(unchecked_data)]
(define-public (transfer-from (amount uint) (owner principal) (recipient principal) )
  (let ((allowance-val (allowance tx-sender owner)))
    (begin
      (if (or (> amount allowance-val) (<= amount u0)) (err false)
        (if (and
              (unwrap! (transfer amount owner recipient) (err false))
              (decrease-allowance amount tx-sender owner))
            (ok true)
            (err false))))))

;; Update the allowance for a given spender
;; #[allow(unchecked_data)]
(define-public (approve (amount uint) (spender principal) )
  (if (and 
        (> amount u0)
        (print (increase-allowance amount spender tx-sender )))
      (ok amount)
      (err false)))

;; Revoke a given spender
;; #[allow(unchecked_data)]
(define-public (revoke (spender principal))
  (let ((allowance-val (allowance spender tx-sender)))
    (if (and 
          (> allowance-val u0)
          (print (decrease-allowance allowance-val spender tx-sender)))
        (ok u0)
        (err false))))

;; Read Only ;;

;; Retrieve the balance of a specific principal
(define-read-only (get-balance (owner principal))
  (ft-get-balance fungible-token owner))

;; Retrieve the current total supply
(define-read-only (get-total-supply)
  (var-get total-supply))

;; Retrieve the name of the token
(define-read-only (get-name) 
  (var-get name))

;; Retrieve the symbol of the token
(define-read-only (get-symbol) 
  (var-get symbol))

;; Retrieve the token-uri of the symbol
(define-read-only (get-uri) 
  (var-get token-uri))

;; Initialize ;;

(begin
  (unwrap! (mint u2000000000000000000 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5) (err false))
  (mint u1000000000000000000 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG))